// controllers/AuthController.js
const formidable = require("formidable");
const db = require("../config/db");
const fs = require("node:fs").promises;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const oracledb = require("oracledb");

const saltRounds = 10;

const toStr = (v) => (Array.isArray(v) ? String(v[0]) : String(v ?? "")); // <-- normalize

class AuthController {
  renderRegisterPage = (req, res) => {
    const { crudToken } = req.cookies;
    if (crudToken) return res.status(200).redirect("/dashboard");
    return res.render("dashboard/register.ejs", {
      title: "Register",
      error: "",
    });
  };

  renderLoginPage = (req, res) => {
    const { crudToken } = req.cookies;
    if (crudToken) return res.status(200).redirect("/dashboard");
    return res.render("dashboard/login.ejs", { title: "Login", error: "" });
  };

  registerUser = async (req, res) => {
    const form = new formidable.IncomingForm({ multiples: false });

    try {
      const { fields, files } = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) =>
          err ? reject(err) : resolve({ fields, files })
        );
      });

      // Normalize field values (Formidable may give arrays)
      const email = toStr(fields.email);
      const password = toStr(fields.password);
      const userType = toStr(fields.userType);

      const stringPassword = String(password);
      const hashedPassword = await bcrypt.hash(stringPassword, saltRounds);

      const imageField = files.image;
      const uploaded = Array.isArray(imageField) ? imageField[0] : imageField;
      const imageNewName = `${Date.now()}${uploaded?.originalFilename || ""}`;

      // 1) Email exists?
      const emailCheckSql = `SELECT COUNT(*) AS CNT FROM users WHERE email = :email`;
      const emailCheckRes = await db.execute(
        emailCheckSql,
        { email },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const emailExists = Number(emailCheckRes.rows?.[0]?.CNT || 0) > 0;
      if (emailExists) {
        return res.status(400).render("dashboard/register.ejs", {
          title: "Register",
          error: "Email already exists",
        });
      }

      // 2) Insert user (auto-commit)
      const insertSql = `
        INSERT INTO users (email, password, img_url, user_type)
        VALUES (:email, :password, :img_url, :user_type)
      `;
      await db.execute(
        insertSql,
        {
          email,
          password: hashedPassword,
          img_url: imageNewName,
          user_type: userType,
        },
        { autoCommit: true }
      );

      // 3) Save image
      if (uploaded?.filepath) {
        const disPath = `${__dirname}/../views/assets/images/${imageNewName}`;
        await fs.copyFile(uploaded.filepath, disPath);
      }

      return res.status(200).redirect("/login");
    } catch (error) {
      return res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  loginUser = async (req, res) => {
    try {
      // Normalize body values too
      const email = toStr(req.body.email);
      const password = toStr(req.body.password);

      const userSql = `
        SELECT user_id, email, password, img_url, user_type
        FROM users
        WHERE email = :email
      `;
      const userRes = await db.execute(
        userSql,
        { email },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const user = userRes.rows?.[0];

      if (!user) {
        return res.status(400).render("dashboard/login.ejs", {
          title: "Login",
          error: "User not found",
        });
      }

      const passwordMatch = await bcrypt.compare(
        password,
        user.PASSWORD ?? user.password
      );
      if (!passwordMatch) {
        return res.status(400).render("dashboard/login.ejs", {
          title: "Login",
          error: "Invalid password",
        });
      }

      const token = jwt.sign(
        {
          id: user.USER_ID ?? user.user_id,
          email: user.EMAIL ?? user.email,
          img_url: user.IMG_URL ?? user.img_url,
          user_type: user.USER_TYPE ?? user.user_type,
        },
        "55VoicesInMyHead",
        { expiresIn: "2d" }
      );

      res.cookie("crudToken", token, {
        expires: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      });

      return res.status(200).redirect("/dashboard");
    } catch (error) {
      return res.status(500).render("dashboard/error.ejs", {
        status: 500,
        title: "Error",
        message: "Internal server error",
        error,
      });
    }
  };

  logoutUser = (req, res) => {
    res.clearCookie("crudToken");
    return res.status(200).redirect("/login");
  };
}

module.exports = new AuthController();
