import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * CREATE USER
 * POST /api/users
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      passwordHash,
      phone,
      department,
      year,
      roleId,
      status,
    } = req.body;

    // Check required fields
    if (!name || !email || !passwordHash || !roleId) {
      return res.status(400).json({
        success: false,
        message: "name, email, passwordHash and roleId are required",
      });
    }

    // Check whether email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Check whether role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Invalid roleId",
      });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        phone,
        department,
        year,
        roleId,
        status,
      },
      include: {
        role: true,
      },
    });

    // Remove passwordHash from response
    const { passwordHash: _, ...safeUser } = user;

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: safeUser,
    });
  } catch (error) {
    console.error("Create user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
};


/**
 * GET ALL USERS
 * GET /api/users
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        department: true,
        year: true,
        roleId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        role: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};


/**
 * GET USER BY ID
 * GET /api/users/:id
 */
export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        department: true,
        year: true,
        roleId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
};


/**
 * UPDATE USER
 * PUT /api/users/:id
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const {
      name,
      email,
      passwordHash,
      phone,
      department,
      year,
      roleId,
      status,
    } = req.body;

    // Check user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check duplicate email
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      });

      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: "User with this email already exists",
        });
      }
    }

    // Validate role if provided
    if (roleId) {
      const role = await prisma.role.findUnique({
        where: { id: roleId },
      });

      if (!role) {
        return res.status(400).json({
          success: false,
          message: "Invalid roleId",
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(passwordHash !== undefined && { passwordHash }),
        ...(phone !== undefined && { phone }),
        ...(department !== undefined && { department }),
        ...(year !== undefined && { year }),
        ...(roleId !== undefined && { roleId }),
        ...(status !== undefined && { status }),
      },
      include: {
        role: true,
      },
    });

    const { passwordHash: _, ...safeUser } = updatedUser;

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: safeUser,
    });
  } catch (error) {
    console.error("Update user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
};


/**
 * DELETE USER
 * DELETE /api/users/:id
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await prisma.user.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};