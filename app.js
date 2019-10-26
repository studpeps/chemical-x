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

const FBO_OIL_RATE_PER_LITRE_UPTO_100 = 4;
const FBO_OIL_RATE_PER_LITRE_UPTO_200 = 4.25;
const FBO_OIL_RATE_PER_LITRE_UPTO_500 = 4.75;
const FBO_OIL_RATE_PER_LITRE_UPTO_1000 = 5.5;
const FBO_OIL_RATE_PER_LITRE_MORE_THAN_1000 = 6.5;

const FACTORY_OIL_RATE_PER_LITRE_UPTO_100 = 4.54;
const FACTORY_OIL_RATE_PER_LITRE_UPTO_200 = 4.82;
const FACTORY_OIL_RATE_PER_LITRE_UPTO_500 = 5.39;
const FACTORY_OIL_RATE_PER_LITRE_UPTO_1000 = 6.47;
const FACTORY_OIL_RATE_PER_LITRE_MORE_THAN_1000 = 7.64;


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
        fboOilCost: Number,
        factoryOilCost: Number,
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

//-------------------------
//------GET REQUESTS------
//-------------------------


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


app.get("/admin",(req,res)=>{
    res.render("login",{admin:true});
})


app.get('/admin/user',(req,res)=>{
    Request.find({assignedFactory:req.query.userID},(err,requests)=>{
        if(err){
            console.log(err);
        }else{
            Factory.findById(req.query.userID,(err,factory)=>{
                if(err){
                    console.log(err)
                }else{
                    res.render('adminUser',{requests:requests,factory:factory});
                }
            })
        }
    })
    
    
})

//-------------------------
//------POST REQUESTS------
//-------------------------


app.post("/newReq",(req,res)=>{
    const pickupRequest = {
        oilAmount : req.body.oilAmount,
        dateOfPickup : new Date(req.body.dateOfPickup)
    };

    
    Factory.find({},(err,factories)=>{
        let distances = [];

        function requestDistance(factory){
            const options = {
                url:"https://maps.googleapis.com/maps/api/distancematrix/json",
                qs:{
                    origins:`${req.user.pincode}`,
                    destinations:`${factory.pinCode}`,
                    language:"en-US",
                    key:process.env.GOOGLE_API_KEY
                },
                timeout: 0
            }
            console.log(options);
            request(options,(error,response,body)=>{
                if(error){
                    console.log(error);
                }else{
                    console.log(body);
                    body = JSON.parse(body);
                    if(body.rows[0].elements[0].status=='OK'){
                        distances.push({
                            distance:body.rows[0].elements[0].distance.value,
                            factoryId:factory._id,
                            factoryName: factory.name
                        })
                    }else{
                        distances.push({
                            distance:99999999999,
                            factoryId: null
                        });
                    }
                    if(factories.length==distances.length)
                    {
                        let min = {
                            distance:distances[0].distance,
                            factoryId: distances[0].factoryId,
                            factoryName: distances[0].factoryName
                        };

                        for(let i=1;i<distances.length;i++){
                            if(distances[i].distance<min.distance){
                                min.distance = distances[i].distance;
                                min.factoryId = distances[i].factoryId;
                                min.factoryName = distances[i].factoryName;
                            }
                        }

                        if(min.factoryId == null){
                            res.redirect('/user');
                        }else{
                                const oilRequest = new Request({
                                dateOfPickup: pickupRequest.dateOfPickup,
                                dateOfRequest:new Date(),
                                oilQuantity: pickupRequest.oilAmount,
                                addr1: req.user.addr1,
                                addr2: req.user.addr2,
                                pinCode:req.user.pincode,
                                username:req.user.username,
                                mobNo:req.user.mobNumber,
                                fboNumber:req.user.fboNumber,
                                status:'Pending Approval',
                                assignedFactory : min.factoryId,
                                assignedFactoryName: min.factoryName,
                                deliverySuccessful: false,
                                expired:false
                            });

                            if(pickupRequest.oilAmount<=100)
                            {
                                oilRequest.set('fboOilCost',FBO_OIL_RATE_PER_LITRE_UPTO_100*pickupRequest.oilAmount);
                                oilRequest.set('factoryOilCost', FACTORY_OIL_RATE_PER_LITRE_UPTO_100*pickupRequest.oilAmount);
                            
                            }else if(pickupRequest.oilAmount<=200)
                            {
                                oilRequest.set('fboOilCost',FBO_OIL_RATE_PER_LITRE_UPTO_200*pickupRequest.oilAmount);
                                oilRequest.set('factoryOilCost', FACTORY_OIL_RATE_PER_LITRE_UPTO_200*pickupRequest.oilAmount);

                            }else if(pickupRequest.oilAmount<=500)
                            {
                                oilRequest.set('fboOilCost',FBO_OIL_RATE_PER_LITRE_UPTO_500*pickupRequest.oilAmount);
                                oilRequest.set('factoryOilCost', FACTORY_OIL_RATE_PER_LITRE_UPTO_500*pickupRequest.oilAmount);

                            }else if(pickupRequest.oilAmount<=1000)
                            {
                                oilRequest.set('fboOilCost',FBO_OIL_RATE_PER_LITRE_UPTO_1000*pickupRequest.oilAmount);
                                oilRequest.set('factoryOilCost', FACTORY_OIL_RATE_PER_LITRE_UPTO_1000*pickupRequest.oilAmount);

                            }else{
                                oilRequest.set('fboOilCost',FBO_OIL_RATE_PER_LITRE_MORE_THAN_1000*pickupRequest.oilAmount);
                                oilRequest.set('factoryOilCost', FACTORY_OIL_RATE_PER_LITRE_MORE_THAN_1000*pickupRequest.oilAmount);
                            }

                            oilRequest.save(()=>{
                                res.redirect("/user");
                            })
                        }
                    }
                }
            
            });
        }
        
        factories.forEach((factory,index)=>{

            requestDistance(factory)


            
        })

    })
    
    
    

    console.log(pickupRequest);
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

app.post('/admin',(req,res)=>{
    Factory.findOne({username:req.body.username},(err,user)=>{
        if(err){
            console.log(err);
        }else{
            if(user){
                if(user.password == req.body.password){
                    res.redirect(`/admin/user/?userID=${user._id}`);
                }else{
                    res.redirect("/admin");
                }
            }else{
                res.redirect("/admin");
            }
        }
    })
})

app.post("/acceptrequest",(req,res)=>{
    console.log(req.body);
    Request.findById(req.body.requestId,(err,foundRequest)=>{
        if(err){
            console.log(err);
        }else{
            foundRequest.status = 'Accepted';
            foundRequest.save(()=>{
                res.redirect(`/admin/user/?userID=${req.body.factoryId}`);
            })
        }
    })
});

app.post("/rejectrequest",(req,res)=>{
    Request.findById(req.body.requestId,(err,foundRequest)=>{
        if(err){
            console.log(err);
        }else{
            foundRequest.status = 'Rejected';
            foundRequest.expired = true;
            foundRequest.save(()=>{
                res.redirect(`/admin/user/?userID=${req.body.factoryId}`);
            });
        }
    })
});

app.post('/pickedUp', (req,res)=>{
    console.log(req.body);
    Request.findById(req.body.requestId,(err,foundRequest)=>{
        if(err){
            console.log(err);
        }else{
            foundRequest.deliverySuccessful = true;
            foundRequest.expired = true;
            foundRequest.status = 'Pick up successful';
            foundRequest.save(()=>{
                res.redirect(`/admin/user/?userID=${req.body.factoryId}`);
            })
        }
    })
});

app.post('/notPickedUp',(req,res)=>{
    Request.findById(req.body.requestId,(err,foundRequest)=>{
        if(err){
            console.log(err);
        }else{
            foundRequest.expired = true;
            foundRequest.status = 'Pick up unsuccessful'
            foundRequest.save(()=>{
                res.redirect(`/admin/user/?userID=${req.body.factoryId}`);
            })
        }
    })
})
app.listen(3000, ()=>{
    console.log("Server running at port 3000");
})