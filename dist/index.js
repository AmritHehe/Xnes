import express from "express";
import { Client } from "pg";
import jwt, {} from "jsonwebtoken";
import { JWT_PASSWORD } from "./configure.js";
import { useMiddleware } from "./middleware.js";
import { createClient } from "redis";
const app = express();
const sub = createClient();
await sub.connect();
let priceBTC;
await sub.subscribe('trades', (message) => {
    priceBTC = JSON.parse(message).price;
    // console.log(priceBTC)
});
const client = new Client({
    user: "postgres",
    host: "localhost", // since Docker forwards port 5432 to localhost
    database: "trades_db",
    password: "Amrit123@",
    port: 5432,
});
let users = [{
        username: "amrit",
        email: "amritbarsiphone@gmail.com",
        balance: 5959,
        pass: "wow",
        wallet: [{ orderId: 234234543453, coin: "sol ", quantity: 69, type: "buy", leverage: true, l: 2 }, { coin: "sol ", quantity: 69, type: "buy", leverage: false, l: 1 }]
    }];
async function start() {
    try {
        await client.connect();
        console.log("connected to timescale db");
    }
    catch (err) {
        console.error("failed to connect to DB:", err);
        process.exit(1);
    }
}
app.use(express.json());
start();
//in memory db ? 
app.post("/signup", (req, res) => {
    const username = req.body.username;
    const email = req.body.email;
    const pass = req.body.pass;
    users.push({ username: username, email: email, balance: 5000, pass: pass, wallet: [] });
    res.json("signup done");
    console.log("new usser signed in " + JSON.stringify(users));
});
app.post("/signin", (req, res) => {
    const username = req.body.username;
    const pass = req.body.pass;
    const user = users.find(user => user.username === username && user.pass === pass);
    if (user) {
        const token = jwt.sign({
            username: user.username
        }, JWT_PASSWORD);
        res.setHeader("Authorization", `Bearer ${token}`);
        // console.log(users);
        return res.json({ message: "Signed in successfully", token });
    }
    else {
        res.status(403).send({
            message: "Invalid username or password"
        });
    }
    //db call in v1
    //hash the pass 
});
app.get("/candles/1m", async (req, res) => {
    // const {interval} = req.params;run dev
    const limit = 100;
    try {
        const result = await client.query(`SELECT * FROM candle_1m
             ORDER BY bucket DESC LIMIT 20`);
        console.log("query sucess");
        return res.json(result.rows);
    }
    catch (err) {
        console.error("query failed");
        return res.status(500).json({ error: "DB query failed" });
    }
});
app.get("/balance", useMiddleware, (req, res) => {
    const token = req.headers.authorization;
    if (token) {
        const userDetails = jwt.verify(token, JWT_PASSWORD);
        const username = userDetails.username;
        const user = users.find(user => user.username === username);
        let balance = user?.balance;
        res.json({ "balance": balance });
    }
    else {
        alert("log in first");
        return;
    }
});
app.post("/order/open", useMiddleware, async (req, res) => {
    const currentprice = priceBTC;
    const token = req.headers.authorization;
    const payload = req.body;
    const orderid = Date.now();
    console.log("payload" + payload.toString());
    //payload  { 
    // qty 
    // type 
    // asset 
    // leverage } 
    if (token) {
        const userDetails = jwt.verify(token, JWT_PASSWORD);
        const username = userDetails.username;
        let user;
        let i = users.findIndex(u => u?.username === username);
        user = users[i];
        if (user) {
            let balance = user.balance;
            const qty = payload.qty;
            let totalprice = currentprice * qty;
            if (payload.type == "buy") {
                if (balance >= totalprice) {
                    if (payload.leverage == 1) {
                        balance -= totalprice;
                        //@ts-ignore
                        users[i].balance = balance;
                        //@ts-ignore
                        users[i].wallet.push({ coin: payload.asset, quantity: qty, type: "buy", leverage: false, l: 1, orderid: orderid });
                    }
                    else if (payload.leverage > 1 && payload.leverage <= 100) {
                        const leverage = payload.leverage;
                        balance -= totalprice;
                        //@ts-ignore
                        users[i].balance = balance;
                        const leveragedPrice = currentprice * qty * leverage;
                        //@ts-ignore
                        users[i].wallet.push({ coin: payload.asset, quantity: qty, type: "buy", leverage: true, l: leverage, lp: leveragedPrice, orderid: orderid });
                    }
                    else {
                        return res.json("good dev if you are here");
                    }
                }
                else {
                    return res.status(403).json("you dont have enough balance");
                }
            }
            else if (payload.type == "sell") {
                let orderid = payload.orderId;
                //@ts-ignore
                if (!users[i]?.wallet[orderid]?.leverage) {
                    balance += totalprice;
                    //@ts-ignore
                    users[i].balance = balance;
                    users[i]?.wallet.pop();
                }
                //@ts-ignore
                else if (users[i]?.wallet[orderid]?.leverage == true) {
                    //@ts-ignore
                    let buyleveragedPrice = users[i]?.wallet[orderid]?.leveragedPrice;
                    //@ts-ignore
                    let leverage = users[i]?.wallet[orderid]?.l;
                    let sellingleveragedPrice = currentprice * qty * leverage;
                    let currentvalue = sellingleveragedPrice - buyleveragedPrice;
                    balance = balance + totalprice + currentvalue;
                }
            }
            //@ts-ignore
            console.log(users[i]);
            res.json("trade executed successfully  balance remaining " + users[i]?.balance + " wallet " + JSON.stringify(users[i]?.wallet) + "order total price" + totalprice);
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
});
app.get("/order", async (req, res) => {
});
app.post("/order/close", async (req, res) => {
    //close the order 
    const asset = req.body.asset;
    let balance = req.body.balance;
    const quantity = req.body.quantity;
    const currentprice = parseFloat(JSON.stringify(await client.query(`SELECT price FROM trades_raw WHERE asset = '${asset}' ORDER BY time DESC LIMIT 1`)));
    balance += currentprice * quantity;
    res.json({
        balance: balance
    });
});
app.listen(3000);
//# sourceMappingURL=index.js.map