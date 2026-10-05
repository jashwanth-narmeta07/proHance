import catchAsync from '../utils/catchAsync.js';
import * as reportService from '../services/report.service.js';

export const attendanceCsv = catchAsync(async (req, res) => {
  const csv = await reportService.generateAttendanceReport(req.user, req.query);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${Date.now()}.csv"`);
  res.status(200).send(csv);
});
