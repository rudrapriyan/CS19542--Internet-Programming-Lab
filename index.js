const db = require("./db")
require('dotenv').config()
const express  = require("express")
const expressLayouts = require("express-ejs-layouts");
const path = require("path")
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken")
const jwtPassword = "secret_123"
const saltRounds = 10;
const app = express()

app.use(express.static(path.join(__dirname, 'public')));
app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(expressLayouts);

const port = process.env.PORT || 3001

async function authentication(req, res, next) {
    const roll = req.body.roll;
    const passwd = req.body.passwd;
    const query = "SELECT password FROM students WHERE roll_number = ?;";

    db.query(query, [roll], async (err, result) => {
        if (err) {
            return res.status(400).send({ error: "Failed to execute query" });
        }

        if (result.length === 0) {
            return res.status(401).send({ error: "User not found" })
        }

        const hashed = result[0].password;
        const match = await bcrypt.compare(passwd, hashed);

        if (match) {
            console.log("Authentication successful");
            const token = jwt.sign({ user: roll }, jwtPassword, { expiresIn: '24h' });
            return res.json(token)
        } else {
            return res.status(401).send({ error: "Invalid password" })
        }
    });
}


function validateToken(req, res, next){
    const token = req.headers['authorization'].split(' ')[1].trim();
    jwt.verify(token, jwtPassword, (err, user) => {
        if (err) return res.status(403).send({
            error: "Invalid User"
        })
        
        req.roll = user.user;
        next();
    })
}

function getGender(roll) {
    return new Promise((resolve, reject) => {
        const query = "SELECT gender FROM students WHERE roll_number = ?";
        db.query(query, [roll], (err, result) => {
            if (err) {
                console.log(err);
                reject(err);
            } else if (result.length > 0) {
                resolve(result[0].gender); 
            } else {
                resolve(null);
            }
        });
    });
}


app.use(express.json())

app.get("/", (req, res)=>{
    res.render("login")
})

app.get("/signupPage", (req,res)=>{
    res.render("signup")
})

app.get('/signup', (req, res) => {
    res.render('signup'); 
});

app.post("/signup", (req, res) => {
    const roll = req.body.roll;
    const email = req.body.email;
    const passwd = req.body.passwd;
    const gender = req.body.gender;

    bcrypt.hash(passwd, saltRounds, function(err, hash) {
        if (err) {
            return res.status(500).send({ error: "Failed to hash password" });
        }

        const query = `INSERT INTO students (roll_number, email, password, gender) VALUES (?, ?, ?, ?)`;
        db.query(query, [roll, email, hash, gender], (err, result) => {
            if (err) {
                return res.status(400).send({ error: "Failed to execute query" });
            }

            res.status(201).send({ message: "Signup successful!" }); 
        });
    });
});



app.post('/login', authentication);

app.get('/rooms', (req, res) => {
    res.render('rooms')
});


app.get('/roomAvailability', (req, res) => {
    res.render('roomAvailability'); 
});




app.post("/singleAvailability", validateToken,async (req, res)=>{
    const roll = req.roll;    
    const gender = await getGender(roll) 
    console.log(gender);
    
    const query = "SELECT * FROM rooms WHERE gender = ? AND room_type = ? AND available_capacity > 0;"
    db.query(query, [gender, "single"],(err, result)=>{
        if(err){
            console.log("err");
            res.status(400).send({
                error : "Unable to Execute"
            })
        }
        if(result!= [])
            res.send(result)
        else 
            res.send(null)
    })

})

app.post("/tripleAvailability", validateToken,async (req, res)=>{
    const roll = req.roll;    
    const gender = await getGender(roll) 
    console.log(gender);
    
    const query = "SELECT * FROM rooms WHERE gender = ? AND room_type = ? AND available_capacity > 0;"
    db.query(query, [gender, "triple"],(err, result)=>{
        if(err){
            console.log("err");
            res.status(400).send({
                error : "Unable to Execute"
            })
        }
        console.log(result);
        
        if(result != [])
            res.send(result)
        else
            res.send(null)
    })

})

app.post("/bookRoom", validateToken, async (req, res) => {
    const roll = req.roll;
    const roomId = req.body.roomId;

    const query = "SELECT available_capacity FROM rooms WHERE room_id = ? AND available_capacity > 0;";
    db.query(query, [roomId], (err, result) => {
        if (err || result.length === 0) {
            return res.status(400).send({ error: "Room is not available or query failed" });
        }
        const updateCapacityQuery = "UPDATE rooms SET available_capacity = available_capacity - 1 WHERE room_id = ?";
        db.query(updateCapacityQuery, [roomId], (err, updateResult) => {
            if (err) {
                return res.status(500).send({ error: "Failed to update room capacity" });
            }
            const insertBookingQuery = "INSERT INTO bookings (roll_number, room_id) VALUES (?, ?)";
            db.query(insertBookingQuery, [roll, roomId], (err, bookingResult) => {
                if (err) {
                    return res.status(500).send({ error: "Failed to book the room" });
                }

                res.send({ message: "Room booked successfully!" });
            });
        });
    });
});

app.get("/myBookings", validateToken, (req, res) => {
    const roll = req.roll;
    const query = "SELECT b.booking_id, r.room_type, r.room_id FROM bookings b JOIN rooms r ON b.room_id = r.room_id WHERE b.roll_number = ?";

    db.query(query, [roll], (err, result) => {
        if (err) {
            return res.status(400).send({ error: "Failed to fetch bookings" });
        }

        res.send(result);
    });
});

app.delete("/cancelBooking/:bookingId", validateToken, (req, res) => {
    const bookingId = req.params.bookingId;
    const roll = req.roll;

    const findBookingQuery = "SELECT room_id FROM bookings WHERE booking_id = ? AND roll_number = ?";
    db.query(findBookingQuery, [bookingId, roll], (err, result) => {
        if (err || result.length === 0) {
            return res.status(400).send({ error: "Booking not found or permission denied" });
        }

        const roomId = result[0].room_id;

        // Delete the booking
        const deleteBookingQuery = "DELETE FROM bookings WHERE booking_id = ?";
        db.query(deleteBookingQuery, [bookingId], (err, deleteResult) => {
            if (err) {
                return res.status(500).send({ error: "Failed to cancel booking" });
            }

            // Increment room capacity
            const incrementCapacityQuery = "UPDATE rooms SET available_capacity = available_capacity + 1 WHERE room_id = ?";
            db.query(incrementCapacityQuery, [roomId], (err, updateResult) => {
                if (err) {
                    return res.status(500).send({ error: "Failed to update room capacity" });
                }

                res.send({ message: "Booking canceled successfully" });
            });
        });
    });
});



app.listen(port);