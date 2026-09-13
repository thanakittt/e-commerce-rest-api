import { describe, beforeEach, it, expect, spyOn } from "bun:test";
import sql from "../db";
import request from "supertest";
import app from "../app";

beforeEach(async () => {
  await sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`;
});


const validUserData = {
  name: "John Doe",
  email: "jon@example.com",
  password: "password123",
  phone: "0812345678",
};

const validLoginData = {
  email: validUserData.email,
  password: validUserData.password,
};

const sendRegisterRequest = (data: any) =>
  request(app).post("/api/auth/register").send(data);

const sendLoginRequest = (data: any) =>
  request(app).post("/api/auth/login").send(data);

describe("POST /api/auth/register", () => {
  it("should return 201 when payload is valid with phone", async () => {
    // Act
    const res = await sendRegisterRequest(validUserData);

    // Assert
    expect(res.status).toBe(201);
    expect(res.body).toStrictEqual({
      success: true,
      message: "User registered successfully",
      data: {
        id: 1,
        name: "John Doe",
        email: "jon@example.com",
        phone: "0812345678",
      },
    });
  });

  it("should return 201 when payload is valid without phone", async () => {
    // Arrange
    const { phone, ...userDataWithoutPhone } = validUserData;

    // Act
    const res = await sendRegisterRequest(userDataWithoutPhone);

    // Assert
    expect(res.status).toBe(201);
    expect(res.body).toStrictEqual({
      success: true,
      message: "User registered successfully",
      data: {
        id: 1,
        name: "John Doe",
        email: "jon@example.com",
        phone: null,
      },
    });
  });

  it("should return 409 when email already exists", async () => {
    // Act
    await sql`INSERT INTO users ${sql(validUserData)}`;
    const res = await sendRegisterRequest(validUserData);

    // Assert
    expect(res.status).toBe(409);
    expect(res.body).toStrictEqual({
      success: false,
      message: "User already exists",
    });
  });

  it("should return 409 when phone already exists", async () => {
    // Arrange
    await sql`INSERT INTO users ${sql(validUserData)}`;

    // Act
    const res = await sendRegisterRequest({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "password123",
      phone: validUserData.phone,
    });

    // Assert
    expect(res.status).toBe(409);
    expect(res.body).toStrictEqual({
      success: false,
      message: "User already exists",
    });
  });

  it("should return 500 when server error", async () => {
    // Arrange
    const spy = spyOn(Bun.password, "hash").mockImplementation(() => {
      throw new Error("Simulated database/hashing failure");
    });

    // Act
    const res = await sendRegisterRequest(validUserData);

    // Assert
    expect(res.status).toBe(500);
    expect(res.body).toStrictEqual({
      success: false,
      message: "Internal server error",
    });

    spy.mockRestore();
  });

  it("should return 400 when body is empty", async () => {
    // Act
    const res = await sendRegisterRequest({});

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validation failed");
    expect(res.body.errors).toBeArray();
    expect(res.body.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("should return 400 when email format is invalid", async () => {
    // Act
    const res = await sendRegisterRequest({
      ...validUserData,
      email: "not-an-email",
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({
      success: false,
      message: "Validation failed",
      errors: [
        {
          location: "body",
          field: "email",
          message: "Invalid email address",
        },
      ],
    });
  });

  it("should return 400 when password is less than 8 characters", async () => {
    // Act
    const res = await sendRegisterRequest({
      ...validUserData,
      password: "123",
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({
      success: false,
      message: "Validation failed",
      errors: [
        {
          location: "body",
          field: "password",
          message: "Password must be at least 8 characters long",
        },
      ],
    });
  });

  it("should return 400 when name is empty", async () => {
    // Act
    const res = await sendRegisterRequest({
      ...validUserData,
      name: "",
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({
      success: false,
      message: "Validation failed",
      errors: [
        {
          location: "body",
          field: "name",
          message: "Name cannot be empty",
        },
      ],
    });
  });
});

describe("POST /api/auth/login", () => {
  it("should return 200 when credentials are valid", async () => {
    // Arrange
    await sendRegisterRequest(validUserData);

    // Act
    const res = await sendLoginRequest(validLoginData);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual({
      success: true,
      message: "User logged in successfully",
      data: {
        token: expect.any(String),
      },
    });
  });

  it("should return 401 when email does not exist", async () => {
    // Arrange
    await sendRegisterRequest(validUserData);

    // Act
    const res = await sendLoginRequest({
      ...validLoginData,
      email: "not_existing_user@email.com",
    });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body).toStrictEqual({
      success: false,
      message: "Invalid credentials",
    });
  });

  it("should return 401 when password is incorrect", async () => {
    // Arrange
    await sendRegisterRequest(validUserData);

    // Act
    const res = await sendLoginRequest({
      ...validLoginData,
      password: "wrongpassword123",
    });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body).toStrictEqual({
      success: false,
      message: "Invalid credentials",
    });
  });

  it("should return 500 when server error occurs", async () => {
    // Arrange
    await sendRegisterRequest(validUserData);
    const spy = spyOn(Bun.password, "verify").mockImplementation(() => {
      throw new Error("Simulated verify failure");
    });

    // Act
    const res = await sendLoginRequest(validLoginData);

    // Assert
    expect(res.status).toBe(500);
    expect(res.body).toStrictEqual({
      success: false,
      message: "Internal server error",
    });

    spy.mockRestore();
  });

  it("should return 400 when body is empty", async () => {
    // Act
    const res = await sendLoginRequest({});

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validation failed");
    expect(res.body.errors).toBeArray();
    expect(res.body.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("should return 400 when email format is invalid", async () => {
    // Act
    const res = await sendLoginRequest({
      ...validLoginData,
      email: "invalid-email-format",
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({
      success: false,
      message: "Validation failed",
      errors: [
        {
          location: "body",
          field: "email",
          message: "Invalid email address",
        },
      ],
    });
  });

  it("should return 400 when password is less than 8 characters", async () => {
    // Act
    const res = await sendLoginRequest({
      ...validLoginData,
      password: "123",
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({
      success: false,
      message: "Validation failed",
      errors: [
        {
          location: "body",
          field: "password",
          message: "Password must be at least 8 characters long",
        },
      ],
    });
  });
});
