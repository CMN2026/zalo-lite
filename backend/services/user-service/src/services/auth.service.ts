import { AccountRepository } from "../repositories/account.repository";
import { hashPassword, comparePassword } from "../utils/password";
import { generateToken } from "../utils/jwt";

export class AuthService {
  private accountRepository: AccountRepository;

  constructor() {
    this.accountRepository = new AccountRepository();
  }

  async register(phone: string, password: string) {
    // Check if account already exists
    const existingAccount = await this.accountRepository.findByPhone(phone);
    if (existingAccount) {
      throw new Error("Account already exists");
    }

    // Validate password
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    // Hash password and create account
    const passwordHash = await hashPassword(password);
    const account = await this.accountRepository.create(phone, passwordHash);

    // Generate token
    const token = generateToken({
      accountId: account.id,
      userId: account.user.id,
      phone: account.phone,
    });

    return {
      success: true,
      message: "Registration successful",
      data: {
        accountId: account.id,
        userId: account.user.id,
        phone: account.phone,
        token,
      },
    };
  }

  async login(phone: string, password: string) {
    // Find account by phone
    const account = await this.accountRepository.findByPhone(phone);
    if (!account) {
      throw new Error("Invalid phone or password");
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, account.password_hash);
    if (!isPasswordValid) {
      throw new Error("Invalid phone or password");
    }

    // Check account status
    if (account.status !== "active") {
      throw new Error("Account is not active");
    }

    // Generate token
    const token = generateToken({
      accountId: account.id,
      userId: account.user!.id,
      phone: account.phone,
    });

    return {
      success: true,
      message: "Login successful",
      data: {
        accountId: account.id,
        userId: account.user!.id,
        phone: account.phone,
        token,
      },
    };
  }

  async logout(accountId: string) {
    // In a real application, you might want to blacklist the token
    // For now, we just return a success response
    return {
      success: true,
      message: "Logout successful",
    };
  }

  async verifyAccount(accountId: string) {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new Error("Account not found");
    }
    return account;
  }
}
