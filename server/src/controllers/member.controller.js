import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as memberService from '../services/member.service.js';

export const invite = catchAsync(async (req, res) => {
  const invitation = await memberService.inviteMember(req.user, req.body);
  return sendSuccess(res, { statusCode: 201, data: { invitation }, message: 'Invitation sent' });
});

export const listInvitations = catchAsync(async (req, res) => {
  const invitations = await memberService.listInvitations(req.user.organizationId, req.query.status);
  return sendSuccess(res, { data: { invitations } });
});

export const revokeInvitation = catchAsync(async (req, res) => {
  await memberService.revokeInvitation(req.user.organizationId, req.params.id);
  return sendSuccess(res, { message: 'Invitation revoked' });
});

// Public - no auth, identity comes from the token itself.
export const acceptInvitation = catchAsync(async (req, res) => {
  const user = await memberService.acceptInvitation(req.body);
  return sendSuccess(res, {
    statusCode: 201,
    data: { user: user.toSafeJSON() },
    message: 'Invitation accepted - you can now log in',
  });
});

export const list = catchAsync(async (req, res) => {
  const members = await memberService.listMembers(req.user, req.query);
  return sendSuccess(res, { data: { members } });
});

export const getOne = catchAsync(async (req, res) => {
  const member = await memberService.getMember(req.user, req.params.id);
  return sendSuccess(res, { data: { member } });
});

export const update = catchAsync(async (req, res) => {
  const member = await memberService.updateMember(req.user, req.params.id, req.body);
  return sendSuccess(res, { data: { member: member.toSafeJSON() }, message: 'Member updated' });
});

export const offboard = catchAsync(async (req, res) => {
  await memberService.offboardMember(req.user, req.params.id);
  return sendSuccess(res, { message: 'Member offboarded' });
});
