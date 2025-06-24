const User = require("../../models/userSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { session } = require("passport");

const pageNotFound = async (req, res) => {

  try {

    res.render("page-404")

  } catch (error) {
    res.redirect("/pageNotFound")

  }
}


const loadHomepage = async (req, res) => {
  try {
    const user = req.session.user;
    let userData = null;

    if (user) {
      userData = await User.findOne({ _id: user._id });
    }

    res.render("home", { user: userData }); // ✅ always pass `user` (null if not logged in)

  } catch (error) {
    console.log("Home page not loading:", error);
    res.status(500).send("Server Error");
  }
};



const loadSignup = async (req, res) => {
  try {
    return res.render('signup', { message: "" });
  } catch (error) {
    console.log('Home page not loading:', error);
    res.status(500).send('Server Error');
  }
};


const loadShopping = async (req, res) => {

  try {

    return res.render('shop');

  } catch (error) {

    console.log('Shopping page not loading:', error);
    res.status(500).send('Server Error');
  }
}

function generateOtp() {
  return Math.floor(100000 + Math.random()*900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`
    });

    console.log("Email Sent Info:", info);
    return info.accepted.length > 0;

  } catch (error) {
    console.error("❌ Error sending email:", error);
    return false;
  }
}


const signup = async(req, res) => {
  try {
    const {name, phone, email, password, cPassword} = req.body;

    if(password !== cPassword) {
      return res.render("signup", {message: "Password do not match"})
    }

    const findUser = await User.findOne({email});
    if(findUser) {
      return res.render("signup", {
        message: "User with this email already exists",
      });
    }

    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email, otp);
    if(!emailSent) {
      return res.json("email-error")
    }

    req.session.userOtp = otp;
    req.session.userData = {
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      password: req.body.password,
    };

    res.render("verify-otp");
    console.log("OTP Sent", otp);

  } catch (error) {

    console.error("signup error", error);
    res.redirect("/pageNotFound")
    
  }
}

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10)

    return passwordHash;

  } catch (error) {
    
  }
}

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const sessionOtp = req.session.userOtp;
    const sessionUser = req.session.userData;
    console.log("Session User Data:", sessionUser);


    console.log("Entered OTP:", otp);
    console.log("Session OTP:", sessionOtp);

    // Check if session data exists
    if (!sessionUser || !sessionOtp) {
      return res.status(400).json({ success: false, message: "Session expired. Please sign up again." });
    }

    if (String(otp).trim() === String(sessionOtp).trim()) {
      const passwordHash = await securePassword(sessionUser.password);

      const saveUserData = new User({
        name: sessionUser.name,
        email: sessionUser.email,
        phone: sessionUser.phone,
        password: passwordHash,
      });

      await saveUserData.save();

      req.session.user = {
      _id: saveUserData._id,
      name: saveUserData.name,
      email: saveUserData.email,
    };

      res.json({ success: true, redirectUrl: "/" });

    } else {
      res.status(400).json({ success: false, message: "Invalid OTP, Please try again" });
    }

  } catch (error) {
    console.error("Error verifying OTP", error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};


const resendOtp = async (req, res) => {
  try {
    
    const {email} = req.session.userData;
    if(!email) {
      return res.status(400).json({success: false, message: "Email not found in session"})
    }

    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email, otp);
    if(emailSent) {
      console.log("Resend OTP:", otp);
      res.status(200).json({success: true, message: "OTP Resend Successfully"})
    } else {
      res.status(500).json({success: false, message: "Failed to resend OTP. Please try again"});
    }
  } catch (error) {

    console.error("Error resending OTP", error);
    res.status(500).json({success: false, message: "Internal server error. Please try again"})
    
  }
}

const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("login", { message: "" }); // ✅ send empty message
    } else {
      res.redirect("/");
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};


const login = async (req, res) => {
  try {
    
    const {email, password} = req.body;

    const findUser = await User.findOne({isAdmin: 0, email: email});

    if(!findUser) {
      return res.render("login", {message: "User not found"})
    }
    if(findUser.isBlocked) {
      res.render("login", {message: "User is blocked by admin"})
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if(!passwordMatch) {
      return res.render("login", {message: "Incorrect Password"})
    }

    req.session.user = {
    _id: findUser._id,
    name: findUser.name,
    email: findUser.email,
    isBlocked: findUser.isBlocked,
  };

    res.redirect("/")

  } catch (error) {
    console.error("login error", error);
    res.render("login", {message: "login failed. Please try again later"})
  }
};

const logout = async (req, res) => {
  try {
    
    req.session.destroy((err) => {
      if(err) {
        console.log("Session destruction error", err.message);
        return res.redirect("/pageNotFound")
      }
      return res.redirect("/login")
    })

  } catch (error) {

    console.log("Logout error", error);
    res.redirect("/pageNotFound")
    
  }
}


module.exports = {
  loadHomepage,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  loadLogin,
  pageNotFound,
  login,
  logout,
  //loadShopping,
};