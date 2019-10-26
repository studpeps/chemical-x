require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const request = require("request");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const passportLocalMongoose = require("passport-local-mongoose");
const _ = require("lodash");

const OIL_RATE_PER_LITRE = 10;

const app = express();


app.set("view engine","ejs");
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(__dirname+'/public'));
app.use(session({   //session to start with these settings
    secret:process.env.SECRET_STRING, //used to encrypt session variables
    resave:false,
    saveUninitialized: false,
    cookie : {
        maxAge: 1000* 60 * 60 *24 * 365
    } //stores cookie for one year
}));

app.use(passport.initialize()); //initializes passport
app.use(passport.session());    //begins session


mongoose.set('useNewUrlParser', true); //remove deprecation warning
mongoose.set('useFindAndModify', false); //remove deprecation warning
mongoose.set('useCreateIndex', true); //remove deprecation warning
mongoose.set('useUnifiedTopology', true); //remove deprecation warning
mongoose.connect("mongodb://localhost:27017/chemicalx"); //connects to mongodb

const userSchema =new mongoose.Schema({
    fboNumber : String,
    mobNumber : String,
    addr1: String,
    addr2: String,
    pincode: String,
    username : String,
    requests : [{
        oilAmount : Number,
        dateOfPickup : Date,
        dateOfRequest:Date,
        assignedFactory : String,
        assignedFactoryName: String,
        status : String
    }]
});


const factorySchema = new mongoose.Schema({
    username:String,
    password:String,
    coordinates:{
        latitude: String,
        longitude: String
    },
    name : String,
    addr: String,
    pinCode:String,
    
});

const requestSchema = new mongoose.Schema({
        dateOfPickup: Date,
        dateOfRequest:Date,
        oilQuantity: Number,
        oilCost: Number,
        addr1: String,
        addr2: String,
        pinCode:String,
        username:String,
        mobNo:String,
        fboNumber:String,
        status:String,
        assignedFactory : String,
        assignedFactoryName: String,
        deliverySuccessful: Boolean,
        expired: Boolean
})

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("userAccount", userSchema);
const Factory = mongoose.model('factory',factorySchema);
const Request = mongoose.model('request',requestSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) { //sets user id as cookie in browser
    done(null, user.id);
});

passport.deserializeUser(function(id, done) { //gets id from cookie and then user is fetched from database
    User.findById(id, function(err, user) {
        done(err, user);
    });
});


app.get("/",(req,res)=>{
    res.render("index");
});

app.get("/login",(req,res)=>{
    res.render("login",{admin:false});
});

app.get("/signup",(req,res)=>{
    res.render("signUp");
});

app.get("/logout",(req,res)=>{
    req.logout();
    res.redirect('/');
});


app.get("/user",(req,res)=>{
    if(req.isAuthenticated()){
        Request.find({username:req.user.username},(err,requests)=>{
            if(err){
                console.log(err);
            }else{
                console.log(requests);
                res.render("fboUser",{requests:requests});
            }
        })
        
    }else{
        res.redirect("/");
    }
});


app.get("/logout",(req,res)=>{
    req.logout();
    res.redirect('/');
});

app.post("/signup",(req,res)=>{
    console.log(req.body);
    const newUser = {
        fboNumber : req.body.fboNumber,
        mobNumber : req.body.phoneNo,
        addr1: req.body.addr1,
        addr2: req.body.addr2,
        pincode: req.body.pinCode,
        username : req.body.username,
        password: req.body.password
    }

    const password = req.body.password;

    User.register(newUser, password , (err,user)=>{
        if(err){
            console.log(err);
            res.redirect("/signup");
        }else{
            passport.authenticate("local")(req,res,()=>{
                res.redirect("/");
            });
        }
    });
});

app.post("/login",(req,res)=>{
    passport.authenticate('local')(req,res,()=>{
        res.redirect(`/user/?userID=${req.user._id}`);
    });
})

app.listen(3000, ()=>{
    console.log("Server running at port 3000");
})