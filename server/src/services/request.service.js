import User from '../models/User.js';
import requestRepository from '../repositories/request.repository.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../config/permissions.js';
import * as notificationService from './notification.service.js';
import * as emailService from './email.service.js';

/**
 * Section 16: the employee never chooses who reviews their request - it's
 * always their own assigned manager plus organization HR, resolved here from
 * the requester's own profile. A single HR user is picked as the request's
 * `hrId` of record (for the approvalHistory/ownership model), but the
 * notification fans out to every active HR user in the organization so
 * nothing depends on exactly one person being available.
 */
async function resolveReviewers(requester) {
  const hrUsers = await User.find({
    organizationId: requester.organizationId,
    role: ROLES.HR,
    status: 'ACTIVE',
  }).select('_id');

  return {
    managerId: requester.managerId || null,
    hrId: hrUsers[0]?._id || null,
    allHrIds: hrUsers.map((u) => u._id),
  };
}

export async function createRequest(requestingUser, payload) {
  const requester = await User.findById(requestingUser.id);
  const { managerId, hrId, allHrIds } = await resolveReviewers(requestingUser);

  const request = await requestRepository.createInOrg(
    {
      requesterId: requestingUser.id,
      managerId,
      hrId,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      payload: payload.payload || {},
      attachments: payload.attachments || [],
      status: 'SUBMITTED',
      approvalHistory: [{ actorId: requestingUser.id, action: 'SUBMITTED', at: new Date() }],
    },
    requestingUser.organizationId
  );

  const requesterName = `${requester.firstName} ${requester.lastName}`;
  const recipientIds = [...(managerId ? [managerId] : []), ...allHrIds];

  await Promise.all(
    recipientIds.map((recipientId) =>
      notificationService.notify(requestingUser.organizationId, {
        recipientId,
        type: 'REQUEST_SUBMITTED',
        title: `New ${payload.type.replace(/_/g, ' ').toLowerCase()} request`,
        message: `${requesterName} submitted: ${payload.title}`,
        relatedEntityType: 'Request',
        relatedEntityId: request._id,
      })
    )
  );

  return request;
}

export async function listMyRequests(requestingUser) {
  return requestRepository.findForRequester(requestingUser.id, requestingUser.organizationId);
}

/**
 * "Requests awaiting my review" - a MANAGER sees requests where they are the
 * assigned manager; HR/ADMIN see the whole organization's requests.
 */
export async function listForReview(requestingUser, status) {
  const { organizationId, role, id } = requestingUser;
  if (role === ROLES.MANAGER) {
    return requestRepository.findForManager(id, organizationId, status);
  }
  if ([ROLES.HR, ROLES.ORGANIZATION_ADMIN].includes(role)) {
    return requestRepository.findForOrganization(organizationId, status);
  }
  throw ApiError.forbidden('You do not have permission to review requests');
}

export async function getRequest(requestingUser, requestId) {
  const request = await requestRepository.findByIdInOrg(requestId, requestingUser.organizationId);
  if (!request) throw ApiError.notFound('Request not found');

  const { role, id } = requestingUser;
  const isOwner = request.requesterId.toString() === id;
  const isAssignedManager = request.managerId?.toString() === id;
  const isOrgLevel = [ROLES.HR, ROLES.ORGANIZATION_ADMIN].includes(role);

  if (!isOwner && !isAssignedManager && !isOrgLevel) {
    throw ApiError.forbidden('You do not have permission to view this request');
  }
  return request;
}

async function assertCanReview(requestingUser, request) {
  const { role, id } = requestingUser;
  const isAssignedManager = role === ROLES.MANAGER && request.managerId?.toString() === id;
  const isOrgLevel = [ROLES.HR, ROLES.ORGANIZATION_ADMIN].includes(role);
  if (!isAssignedManager && !isOrgLevel) {
    throw ApiError.forbidden('You are not authorized to review this request');
  }
}

export async function moveToReview(requestingUser, requestId, comment) {
  const request = await requestRepository.findByIdInOrg(requestId, requestingUser.organizationId);
  if (!request) throw ApiError.notFound('Request not found');
  await assertCanReview(requestingUser, request);
  if (request.status !== 'SUBMITTED') {
    throw ApiError.conflict('Only a submitted request can be moved to review', 'INVALID_STATUS_TRANSITION');
  }

  request.status = 'UNDER_REVIEW';
  request.approvalHistory.push({ actorId: requestingUser.id, action: 'MOVED_TO_REVIEW', comment, at: new Date() });
  await request.save();
  return request;
}

async function resolveRequest(requestingUser, requestId, decision, comment) {
  const request = await requestRepository.findByIdInOrg(requestId, requestingUser.organizationId);
  if (!request) throw ApiError.notFound('Request not found');
  await assertCanReview(requestingUser, request);
  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(request.status)) {
    throw ApiError.conflict('This request has already been resolved', 'INVALID_STATUS_TRANSITION');
  }

  request.status = decision;
  request.approvalHistory.push({
    actorId: requestingUser.id,
    action: decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
    comment,
    at: new Date(),
  });
  await request.save();

  const requesterUser = await User.findById(request.requesterId);

  await notificationService.notify(requestingUser.organizationId, {
    recipientId: request.requesterId,
    type: 'REQUEST_STATUS_CHANGED',
    title: `Your request was ${decision.toLowerCase()}`,
    message: `"${request.title}" has been ${decision.toLowerCase()}${comment ? `: ${comment}` : ''}`,
    relatedEntityType: 'Request',
    relatedEntityId: request._id,
  });

  if (requesterUser) {
    await emailService.sendRequestStatusEmail({
      to: requesterUser.email,
      requestType: request.type,
      status: decision,
    });
  }

  return request;
}

export const approveRequest = (requestingUser, requestId, comment) =>
  resolveRequest(requestingUser, requestId, 'APPROVED', comment);

export const rejectRequest = (requestingUser, requestId, comment) =>
  resolveRequest(requestingUser, requestId, 'REJECTED', comment);
