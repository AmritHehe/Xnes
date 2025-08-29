import express from "express"
import {Client} from "pg"
import jwt, { type JwtHeader, type JwtPayload } from "jsonwebtoken"
import { JWT_PASSWORD } from "./configure.js"
import { useMiddleware } from "./middleware.js"
import { createClient } from "redis"
const app = express()


const sub = createClient(); 
await sub.connect(); 
let  priceBTC :number

await sub.subscribe('trades' , (message) => { priceBTC = JSON.parse(message).price
    
    ;
    // console.log(priceBTC)

    //liquidisation ! will come here 
})
function closeOrder(username : string , orderId : number){ 
    let user = users.get(username); 
    if(user){
    const order = user?.wallet.find(O => O.orderId === orderId )
    order!.orderType="closed"
    users.set(username , user)
    }

}
sub.on("message" , (username)=> { 
    let user =  users.get(username); 
    let wallet = user?.wallet; 
    if(wallet){
        for(let i = 0 ; i < wallet!.length ; i++){ 
            if(wallet[i]!.orderType =="open" ){ 
                if(!wallet[i]?.leverage){
                    let currentprice = priceBTC * wallet[i]!.quantity; 
                    let loss = wallet[i]!.buyPrice - currentprice;
                    if(loss >= 0.9*wallet[i]!.buyPrice){ 
                     closeOrder(username , wallet[i]!.orderId)
                    }
                }
                else if(wallet[i]?.leverage){ 
                    let currentprice = priceBTC * wallet[i]!.quantity * wallet[i]!.l;
                    let buyLeveragedPrice = wallet[i]?.buyLeveragedPrice ; 
                    if(buyLeveragedPrice){
                        let loss = buyLeveragedPrice - currentprice 
                        if(loss >= 0.9*wallet[i]!.buyPrice){ 
                            closeOrder(username, wallet[i]!.orderId)
                        }
                    }
                }
            }
        }
    }
})


const client = new Client({
  user: "postgres",
  host: "localhost",    // since Docker forwards port 5432 to localhost
  database: "trades_db",
  password: "Amrit123@", 
  port: 5432,
});

//

let users =  new Map<string,{
    username : string ;
    email : string ;
    balance : number ;
    pass : string  ;
    wallet : {
    orderId : number ;
    coin : string ;
    quantity : number ;
    type ?: string ;
    leverage : boolean ;
    l : number ;
    buyPrice : number ;
    orderType ?:string;
    buyLeveragedPrice ?: number ;
    soldLeveragedPrice ?: number ; 
    sellPrice? : number
    }[];
    }>(); 

    users.set("amrit", {
    username : "amrit", 
    email : "amritbarsiphone@gmail.com",
    balance : 5959 , 
    pass : "wow",
    wallet : [{ orderId  : 234234543453 , coin : "sol " , quantity : 69  , type : "buy" , leverage : true , l : 2 , orderType : "open" , buyPrice : 200 , sellPrice : 300},{orderId: 234303095343 , coin : "sol " , quantity : 69  , type : "buy" , leverage : false ,   l : 1 , orderType : "close"  , buyPrice : 300 , sellPrice : 500}]
    })

async function start() {
  try {
    await client.connect();
    console.log("connected to timescale db");
  } catch (err) {
    console.error("failed to connect to DB:", err);
    process.exit(1);
  }
}
app.use(express.json())

start()
//in memory db ? 

app.post("/signup" , (req , res)=> { 
    const username = req.body.username; 
    const email = req.body.email; 
    const pass = req.body.pass;

    if(users.has(username)){ 
        return res.status(400).json({error : "username already taken "})
    }
    if(username){
        users?.set(username , {username : username , email :email , balance :5000 , pass : pass , wallet :[]})
    }

    res.json("signup done")
    console.log("new usser signed in " + JSON.stringify(users))
})

app.post("/signin" , (req, res)=> { 
    const username = req.body.username ; 
    const pass = req.body.pass;

    const user = users.get(username)
     if (user && user.pass==pass ) {
        const token = jwt.sign({
            username: user.username
        }, JWT_PASSWORD);
        res.setHeader("Authorization", `Bearer ${token}`);
        // console.log(users);
        return res.json({ message: "Signed in successfully", token });
    } else {
        res.status(403).send({
            message: "Invalid username or password"
        })
    }

    //db call in v1
    //hash the pass 
})

app.get("/candles/1m" , async (req, res)=> { 
    // const {interval} = req.params;run dev
    const limit = 100;

    try { 
        const result  = await client.query(
            `SELECT * FROM candle_1m
             ORDER BY bucket DESC LIMIT 20` 
        );
        console.log("query sucess")
        return res.json(result.rows);
        
        }
    catch(err) { 
        console.error("query failed")
        return res.status(500).json({ error: "DB query failed" });
    } })

app.get("/balance" , useMiddleware,(req , res) => { 
    const token :string | undefined = req.headers.authorization ;
    if(token){
         const userDetails :any  = jwt.verify(token, JWT_PASSWORD) ;
         const username   = userDetails.username ;
         const user = users.get(username)
         let balance = user?.balance
        res.json({"balance" : balance})
    }
    else{ 
        alert("log in first")
        return;
    }

})

app.post("/order/open", useMiddleware , async(req , res)=> { 
    const currentprice = priceBTC;
    const token  :any = req.headers.authorization;
    const payload = req.body ;
    const orderid = Date.now()
    console.log("payload" + JSON.stringify(payload))
    //payload  { 
    // qty 
    // type 
    // asset 
    // leverage } 
    if(token){
    const userDetails :any  = jwt.verify(token, JWT_PASSWORD) ;
    const username  = userDetails.username ;
    let user = users.get(username)
    
    if(user){
        console.log("user to milgya")
        let balance = user.balance; 
        const qty = payload.qty; 
        let totalprice = currentprice * qty;
        if(payload.type == "buy" ){
            console.log("yha tk bhi agya")
            if(balance >=totalprice){
                if(!payload.leverage){
                    balance -= totalprice ;
                    //@ts-ignore
                    user.balance = balance; 
                    //@ts-ignore
                    user.wallet.push({coin : payload.asset  , quantity : qty , type : "buy" , leverage :false , l :1 , orderId : orderid , orderType : "open" , buyPrice : totalprice})
                    users.set(username, user);
                }

                else if(payload.leverage) { 
                    const leverage = payload.l;
                    balance -= totalprice;
                    //@ts-ignore
                    user.balance = balance; 
                     const leveragedPrice = currentprice*qty*leverage;
                     //@ts-ignore
                     user.wallet.push({coin : payload.asset  , quantity : qty , type : "buy" , leverage : true ,l : leverage , buyLeveragedPrice :leveragedPrice , orderId : orderid , orderType : "open" , buyPrice : totalprice})
                     users.set(username, user);
                    }

                else { 
                    return res.json("good dev if you are here")
                }
            }
            else{ 
                return res.status(403).json("you dont have enough balance")
            }
        }
        else if(payload.type == "sell"){ 
            const orderid : number= payload.orderId
            const order = user.wallet.find(o => o.orderId === orderid)
            console.log("found the order" + order)
            if(!order?.leverage){
                balance += totalprice;
                //@ts-ignore
                user.balance = balance; 
                
                order!.orderType = "closed"
                order!.sellPrice = totalprice;
                users.set(username, user);
            }
            else if (order?.leverage){ 
               let buyPrice = order.buyPrice ;
               let buyleveragedPrice =  order.buyLeveragedPrice 
               if(buyleveragedPrice){
               let leverage = order.l
               let sellingleveragedPrice = currentprice*qty*leverage;
               let currentvalue = sellingleveragedPrice - buyleveragedPrice;
               balance = balance + currentvalue + payload.buyPrice;
               order.soldLeveragedPrice = sellingleveragedPrice;
               user.balance = balance ; 
               order!.orderType = "closed"
               order.sellPrice = totalprice;

               users.set(username, user);

               }
               else { 
                console.log("some error happened")
               }
            }
        }
        
        
        //@ts-ignore
        
        console.log(users)
        res.json("trade executed successfully  balance remaining " + user.balance + " wallet " + JSON.stringify(user.wallet) + "order total price" + totalprice )
        }

    } 
    
    //update the balance of user , update the wallet , show that you bought the trade on frontend

    // const currentprice :number =  parseFloat(JSON.stringify(await client.query(`SELECT price FROM trades_raw WHERE asset = '${asset}' ORDER BY time DESC LIMIT 1`)))
    // if((quantity*currentprice)<=userbalance){ 
        //process the trade 
        //update the wallet

    //     res.json({ 
    //         // "balance" : {userbalance-{quantity*currentprice}}
    //       //  "order id " : "" what order id 
    //     })

    // }
    // else{ 
    //     //dont process the trade
    // }
    // //stoploss 
    // //tade profit
    
})
app.get("/order" , async(req ,res)=> { 

    
    
}) 
app.post("/order/close" , async (req, res)=> { 
    //close the order 
    const asset = req.body.asset;
    let balance = req.body.balance ; 
    const quantity = req.body.quantity ;
    const currentprice :number =  parseFloat(JSON.stringify(await client.query(`SELECT price FROM trades_raw WHERE asset = '${asset}' ORDER BY time DESC LIMIT 1`)))
    balance += currentprice * quantity

    res.json({ 
        balance : balance
    })
})
app.listen(3000)