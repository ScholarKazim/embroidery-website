import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

export const universityRouter = Router();

/**
 * @route GET /api/v1/universities
 * @desc Get list of all available universities
 * @access Public
 */
universityRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const universities = await prisma.university.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        createdAt: true,
        _count: {
          select: { colleges: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: universities,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v1/universities/:id/colleges
 * @desc Get colleges belonging to a specific university
 * @access Public
 */
universityRouter.get('/:id/colleges', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const university = await prisma.university.findUnique({
      where: { id },
      include: {
        colleges: {
          select: {
            id: true,
            name: true,
            code: true,
            fixedEntityId: true,
            createdAt: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!university) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'الجامعة المطلوبة غير موجودة',
      });
      return;
    }

    res.status(200).json({
      success: true,
      university: {
        id: university.id,
        name: university.name,
        code: university.code,
      },
      colleges: university.colleges,
    });
  } catch (error) {
    next(error);
  }
});
