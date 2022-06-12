const express = require("express");
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
require("dotenv").config();
const app = express();

const PORT = process.env.PORT || 4000;

const initializePassport = require("./passportConfig");

initializePassport(passport);

// Middleware

// Parses details from a form
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");

app.use(
  session({
    // Key we want to keep secret which will encrypt all of our information
    secret: process.env.SESSION_SECRET,
    // Should we resave our session variables if nothing has changes which we dont
    resave: false,
    // Save empty value if there is no vaue which we do not want to do
    saveUninitialized: false
  })
);
// Funtion inside passport which initializes passport
app.use(passport.initialize());
// Store our variables to be persisted across the whole session. Works with app.use(Session) above
app.use(passport.session());
app.use(flash());


// Routes

// Render Home Page
app.get("/", (req, res) => {
  res.render("index");
});

// Render Register Form
app.get("/users/register", checkAuthenticated, (req, res) => {
  res.render("register.ejs");
});

// Render Login Form
app.get("/users/login", checkAuthenticated, (req, res) => {
  // flash sets a messages variable. passport sets the error message
  console.log(req.session.flash.error);
  res.render("login.ejs");
});

// Render Dashboard
app.get("/users/dashboard", checkNotAuthenticated, async (req, res) => {
  console.log(req.isAuthenticated());
  let employees = await pool.query(
    'SELECT * FROM emp'
  )
  await console.log(employees)
  await console.log(employees.rows)
  await res.render("dashboard", { user: req.user.name, list : employees.rows, show : false } );
});

// For Logout Action
app.get("/users/logout", (req, res) => {
  req.logout();
  res.render("index", { message: "You have logged out successfully" });
});


// For Register Action
app.post("/users/register", async (req, res) => {
  let { name, email, password, password2 } = req.body;

  let errors = [];

  console.log({
    name,
    email,
    password,
    password2
  });

  if (!name || !email || !password || !password2) {
    errors.push({ message: "Please enter all fields" });
  }

  if (password.length < 6) {
    errors.push({ message: "Password must be a least 6 characters long" });
  }

  if (password !== password2) {
    errors.push({ message: "Passwords do not match" });
  }

  if (errors.length > 0) {
    res.render("register", { errors, name, email, password, password2 });
  } else {
    hashedPassword = await bcrypt.hash(password, 10);
    console.log(hashedPassword);

    // Validation passed
    pool.query(
      `SELECT * FROM users
        WHERE email = $1`,
      [email],
      (err, results) => {
        if (err) {
          console.log(err);
        }
        console.log(results.rows);

        if (results.rows.length > 0) {
          return res.render("register", {
            message: "Email already registered"
          });
        } else {
          pool.query(
            `INSERT INTO users (name, email, password)
                VALUES ($1, $2, $3)
                RETURNING id, password`,
            [name, email, hashedPassword],
            (err, results) => {
              if (err) {
                throw err;
              }
              console.log(results.rows);
              req.flash("success_msg", "You are now registered. Please log in");
              res.redirect("/users/login");
            }
          );
        }
      }
    );
  }
});

// For Login Action
app.post(
  "/users/login",
  passport.authenticate("local", {
    successRedirect: "/users/dashboard",
    failureRedirect: "/users/login",
    failureFlash: true
  })
);

// Render Update Form
app.get("/users/emp/edit/:id", async (req,res) => {
  console.log(req.params.id)
  
  let employees = await pool.query(
    'SELECT * FROM emp WHERE id = $1',
    [req.params.id]
  )
  await console.log(employees)
  await console.log("edit form")
  await console.log(employees.rows)
  await res.render("update", {id: employees.rows[0].id, name : employees.rows[0].name, email : employees.rows[0].email, age : employees.rows[0].age, salary : employees.rows[0].salary, experience : employees.rows[0].experience})
})

// For Update Action
app.post("/users/emp/update/:id", async (req,res) => {
  let {name, email, age, salary, experience} = req.body;
  console.log({name, email, age, salary, experience})
  console.log(req.params.id)
  await pool.query('UPDATE emp SET name= $1, email = $2, age = $3, salary = $4, experience = $5 WHERE id = $6',
    [name,email,age,salary,experience,req.params.id]
  )
  res.redirect("/users/dashboard")
})

// For Delete Action
app.get("/users/emp/delete/:id", (req,res) => {
  console.log(req.params.id)
  pool.query(
    'DELETE FROM emp WHERE id = $1',
    [req.params.id]
  )
  res.redirect("/users/dashboard")
})

// For Add Action
app.post("/users/emp/add", async (req,res) => {
  let {name, email, age, salary, experience} = req.body;
  console.log({name, email, age, salary, experience})
  pool.query(
  `INSERT INTO emp (name, email, age, salary, experience)
      VALUES ($1, $2, $3, $4, $5)`,
  [name, email, age, salary, experience],
  (err, results) => {
    if (err) {
      throw err;
    }
    req.flash("success_msg", "Employee added successfully !");
    res.redirect("/users/dashboard");
  });
})

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/users/dashboard");
  }
  next();
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/users/login");
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
