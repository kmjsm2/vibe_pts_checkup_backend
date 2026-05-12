import { Router } from "express";
import { Patient } from "../models/Patient.js";

export const statsRouter = Router();

statsRouter.get("/", async (_req, res) => {
  try {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [byDepartment, byBloodType, byMonth] = await Promise.all([
      Patient.aggregate([
        {
          $group: {
            _id: {
              $ifNull: ["$department", "(미기재)"],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1, _id: 1 } },
        {
          $project: {
            _id: 0,
            department: "$_id",
            count: 1,
          },
        },
      ]),
      Patient.aggregate([
        {
          $group: {
            _id: {
              $ifNull: ["$bloodType", "(미기재)"],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            bloodType: "$_id",
            count: 1,
          },
        },
      ]),
      Patient.aggregate([
        {
          $match: {
            lastCheckupDate: { $gte: sixMonthsAgo, $lte: now },
          },
        },
        {
          $group: {
            _id: {
              y: { $year: "$lastCheckupDate" },
              m: { $month: "$lastCheckupDate" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.y": 1, "_id.m": 1 } },
        {
          $project: {
            _id: 0,
            year: "$_id.y",
            month: "$_id.m",
            count: 1,
          },
        },
      ]),
    ]);

    res.json({
      byDepartment,
      byBloodType,
      checkupsByMonth: byMonth,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});
