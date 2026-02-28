import { prisma } from "../lib/prisma";

export class AccountRepository {
  async findByPhone(phone: string) {
    return prisma.account.findUnique({
      where: { phone },
      include: { user: true },
    });
  }

  async findById(id: string) {
    return prisma.account.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  async create(phone: string, passwordHash: string, accountType: string = "individual") {
    const account = await prisma.account.create({
      data: {
        phone,
        password_hash: passwordHash,
        account_type: accountType,
        status: "active",
      },
      include: { user: true },
    });

    // Create associated user
    const user = await prisma.user.create({
      data: {
        account_id: account.id,
        full_name: null,
        email: null,
      },
    });

    return { ...account, user };
  }

  async update(id: string, data: { password_hash?: string; status?: string }) {
    return prisma.account.update({
      where: { id },
      data,
      include: { user: true },
    });
  }

  async delete(id: string) {
    return prisma.account.delete({
      where: { id },
    });
  }
}
