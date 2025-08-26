import express from "express"
const app = express()



let users :{username : string , email : string ,balance : number , pass : string  , wallet : object[]}[] = [{ 
    username : "amrit", 
    email : "amritbarsiphone@gmail.com",
    balance : 5959 , 
    pass : "wow",
    wallet : [{coin : "sol " , quantity : 69  , type : "buy"},{coin : "sol " , quantity : 69  , type : "buy"}]
}]
app.use(express.json())


//in memory db ? 

app.post("/signup" , (req , res)=> { 
    const username = req.body.name; 
    const email = req.body.email; 
    const pass = req.body.pass;


    users.push({username : username , email :email , balance :5000 , pass : pass , wallet :[]})

    res.json("signup done")
})

app.post("/signin" , (req, res)=> { 
    const username = req.body.username ; 
    const pass = req.body.pass;

    for(let i = 0 ; i < users.length ; i++){ 
        if (users[i]?.username == username && users[i]?.pass == pass){ 
            //return jwt authenticaton token 
            res.json("signed in succesfully")
        }
    }

    //db call
})


app.get("/candles" , (req, res)=> { 
    //get binance data here ? or get data from candlestick
    const asset = req.body.asset

})

app.get("/balance" , (req , res) => { 
    const username = req.body.username
    let balance 
    for(let i = 0; i < users.length ;i++){ 
        if(users[i]?.username == username ){ 
            balance = users[i]?.balance
        }
    }
    res.json({"balance" : balance})
})



app.listen(3000)