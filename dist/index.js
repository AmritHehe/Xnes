import express from "express";
import { Client } from "pg";
import jwt, {} from "jsonwebtoken";
import { JWT_PASSWORD } from "./configure.js";
import { useMiddleware } from "./middleware.js";
import { createClient } from "redis";
import cors from "cors";
const app = express();
app.use(cors());
const sub = createClient();
await sub.connect();
let priceBTC;
let buyPriceBTC;
await sub.subscribe('trades', (message) => {
    priceBTC = JSON.parse(message).price;
    buyPriceBTC = JSON.parse(message).buy;
    for (const [username, user] of users) {
        let wallet = user.wallet;
        if (wallet) {
            for (let j = 0; j < wallet.length; j++) {
                if (wallet[j].orderType == "open") {
                    if (!wallet[j]?.leverage) {
                        let currentprice = priceBTC * wallet[j].quantity;
                        let buyCurrentPrice = buyPriceBTC * wallet[j].quantity;
                        let loss;
                        if (wallet[j]?.tradeType == "buy") {
                            loss = wallet[j].buyPrice - currentprice;
                            console.log("loss " + loss);
                            console.log("bought at price " + wallet[j].buyPrice + "currentbtc price " + priceBTC);
                        }
                        else if (wallet[j]?.tradeType == "sell") {
                            loss = buyCurrentPrice - wallet[j].buyPrice;
                            console.log("loss " + loss);
                            console.log("bought at price " + wallet[j].buyPrice + "currentbtc price " + buyPriceBTC);
                        }
                        console.log();
                        if (loss) {
                            if (loss >= 0.9 * wallet[j].buyPrice) {
                                closeOrder(username, wallet[j].orderId, priceBTC, currentprice);
                                console.log("sold the order hehe");
                            }
                        }
                    }
                    else if (wallet[j]?.leverage) {
                        let currentprice = priceBTC * wallet[j].quantity;
                        let buyCurrentPrice = buyPriceBTC * wallet[j].quantity;
                        let buyLeveragedPrice = wallet[j]?.buyLeveragedPrice;
                        let entryprice = wallet[j].buyPrice;
                        if (buyLeveragedPrice) {
                            let loss;
                            if (wallet[j]?.tradeType == "buy") {
                                loss = (entryprice - currentprice) * wallet[j].l;
                                console.log("loss " + loss);
                                console.log("bought at price " + buyLeveragedPrice + "currentbtc price " + priceBTC);
                            }
                            else if (wallet[j]?.tradeType == "sell") {
                                loss = (buyCurrentPrice - entryprice) * wallet[j].l;
                                console.log("loss " + loss);
                                console.log("bought at price " + buyLeveragedPrice + "currentbtc price " + buyPriceBTC);
                            }
                            if (loss) {
                                if (loss >= 0.9 * entryprice) {
                                    closeOrder(username, wallet[j].orderId, priceBTC, currentprice);
                                    console.log("sold the order  ");
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    ;
    // console.log(priceBTC)
    //liquidisation ! will come here 
});
function closeOrder(username, orderId, priceBTC, sellingleveragedPrice) {
    let user = users.get(username);
    if (user) {
        const order = user?.wallet.find(O => O.orderId === orderId);
        order.orderType = "closed";
        order.sellPrice = priceBTC;
        order.soldLeveragedPrice = sellingleveragedPrice;
        users.set(username, user);
    }
}
// sub.on("message" , ()=> { 
//     for ( const [username , user] of users){
//         let wallet = user.wallet; 
//         if(wallet){
//             for(let j = 0 ; j < wallet!.length ; j++){ 
//                 if(wallet[j]!.orderType =="open" ){ 
//                     if(!wallet[j]?.leverage){
//                         let currentprice = priceBTC * wallet[j]!.quantity; 
//                         let loss = wallet[j]!.buyPrice - currentprice;
//                         if(loss >= 0.9*wallet[j]!.buyPrice){ 
//                             closeOrder(username , wallet[j]!.orderId)
//                             console.log("sold the order hehe")
//                         }
//                     }
//                     else if(wallet[j]?.leverage){ 
//                         let currentprice = priceBTC * wallet[j]!.quantity * wallet[j]!.l;
//                         let buyLeveragedPrice = wallet[j]?.buyLeveragedPrice ; 
//                         if(buyLeveragedPrice){
//                             let loss = buyLeveragedPrice - currentprice 
//                             console.log("loss " + loss )
//                             if(loss >= 0.9*wallet[j]!.buyPrice){ 
//                                 closeOrder(username, wallet[j]!.orderId)
//                                 console.log("sold the order ")
//                             }
//                         }
//                     }
//                 }
//             }
//         }
//     }
// })
const client = new Client({
    user: "postgres",
    host: "localhost", // since Docker forwards port 5432 to localhost
    database: "trades_db",
    password: "Amrit123@",
    port: 5432,
});
//
let users = new Map();
users.set("amrit", {
    username: "amrit",
    email: "amritbarsiphone@gmail.com",
    balance: 5959,
    pass: "wow",
    wallet: [{ orderId: 234234543453, coin: "sol ", quantity: 69, type: "buy", leverage: true, l: 2, orderType: "open", buyPrice: 200, sellPrice: 300 }, { orderId: 234303095343, coin: "sol ", quantity: 69, type: "buy", leverage: false, l: 1, orderType: "close", buyPrice: 300, sellPrice: 500 }]
});
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
    if (users.has(username)) {
        return res.status(400).json({ error: "username already taken " });
    }
    if (username) {
        users?.set(username, { username: username, email: email, balance: 5000, pass: pass, wallet: [] });
    }
    res.json("signup done");
    console.log("new usser signed in " + JSON.stringify(users));
});
app.post("/signin", (req, res) => {
    const username = req.body.username;
    const pass = req.body.pass;
    const user = users.get(username);
    if (user && user.pass == pass) {
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
             ORDER BY bucket DESC LIMIT 1000`);
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
        const user = users.get(username);
        let balance = user?.balance;
        res.json({ "balance": balance });
    }
    else {
        alert("log in first");
        return;
    }
});
app.post("/order/open", useMiddleware, async (req, res) => {
    const currentprice = buyPriceBTC;
    const currentSellPrice = priceBTC;
    const token = req.headers.authorization;
    const payload = req.body;
    const orderid = Date.now();
    console.log("payload" + JSON.stringify(payload));
    //payload  { 
    // qty 
    // type 
    // asset 
    // leverage } 
    if (token) {
        const userDetails = jwt.verify(token, JWT_PASSWORD);
        const username = userDetails.username;
        let user = users.get(username);
        if (user) {
            console.log("user to milgya");
            let balance = user.balance;
            const qty = payload.qty;
            let totalprice = currentprice * qty;
            let totalSellPrice = currentSellPrice * qty;
            if (payload.type == "buy") {
                console.log("yha tk bhi agya");
                if (balance >= totalprice) {
                    if (!payload.leverage) {
                        balance -= totalprice;
                        //@ts-ignore
                        user.balance = balance;
                        //@ts-ignore
                        user.wallet.push({ coin: payload.asset, quantity: qty, tradeType: "buy", type: "buy", leverage: false, l: 1, orderId: orderid, orderType: "open", buyPrice: totalprice });
                        users.set(username, user);
                    }
                    else if (payload.leverage) {
                        const leverage = payload.l;
                        balance -= totalprice;
                        //@ts-ignore
                        user.balance = balance;
                        const leveragedPrice = currentprice * qty * leverage;
                        //@ts-ignore
                        user.wallet.push({ coin: payload.asset, quantity: qty, tradeType: "buy", type: "buy", leverage: true, l: leverage, buyLeveragedPrice: leveragedPrice, orderId: orderid, orderType: "open", buyPrice: totalprice });
                        users.set(username, user);
                    }
                    else {
                        return res.json("good dev if you are here");
                    }
                }
                else {
                    return res.status(403).json("you dont have enough balance" + balance + "total price" + totalprice);
                }
            }
            else if (payload.type == "sell") {
                const orderid = payload.orderId;
                const order = user.wallet.find(o => o.orderId === orderid);
                console.log("found the order" + order);
                if (!order?.leverage) {
                    let profit = totalSellPrice - order.buyPrice;
                    balance = balance + (order.buyPrice + profit);
                    //@ts-ignore
                    user.balance = balance;
                    order.orderType = "closed";
                    order.sellPrice = totalprice;
                    users.set(username, user);
                }
                else if (order?.leverage) {
                    let buyPrice = order.buyPrice;
                    let buyleveragedPrice = order.buyLeveragedPrice;
                    if (buyleveragedPrice) {
                        let leverage = order.l;
                        let sellingleveragedPrice = currentSellPrice * qty * leverage;
                        let profit = sellingleveragedPrice - buyleveragedPrice;
                        balance = balance + (buyPrice + profit);
                        order.soldLeveragedPrice = sellingleveragedPrice;
                        user.balance = balance;
                        order.orderType = "closed";
                        order.sellPrice = totalprice;
                        users.set(username, user);
                    }
                    else {
                        console.log("some error happened");
                    }
                }
            }
            //@ts-ignore
            console.log(users);
            res.json("trade executed successfully  balance remaining " + user.balance + " wallet " + JSON.stringify(user.wallet) + "order total price" + totalprice);
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
app.post("/trade/sell", async (req, res) => {
    const currentprice = priceBTC;
    const currentSellPrice = buyPriceBTC;
    const token = req.headers.authorization;
    const payload = req.body;
    const orderid = Date.now();
    console.log("payload" + JSON.stringify(payload));
    //payload  { 
    // qty 
    // type 
    // asset 
    // leverage } 
    if (token) {
        const userDetails = jwt.verify(token, JWT_PASSWORD);
        const username = userDetails.username;
        let user = users.get(username);
        if (user) {
            console.log("user to milgya");
            let balance = user.balance;
            const qty = payload.qty;
            let totalprice = currentprice * qty;
            let totalSellPrice = currentSellPrice * qty;
            if (payload.type == "buy") {
                console.log("yha tk bhi agya");
                if (balance >= totalprice) {
                    if (!payload.leverage) {
                        balance -= totalprice;
                        //@ts-ignore
                        user.balance = balance;
                        //@ts-ignore
                        user.wallet.push({ coin: payload.asset, quantity: qty, tradeType: "sell", type: "buy", leverage: false, l: 1, orderId: orderid, orderType: "open", buyPrice: totalprice });
                        users.set(username, user);
                    }
                    else if (payload.leverage) {
                        const leverage = payload.l;
                        balance -= totalprice;
                        //@ts-ignore
                        user.balance = balance;
                        const leveragedPrice = currentprice * qty * leverage;
                        //@ts-ignore
                        user.wallet.push({ coin: payload.asset, quantity: qty, tradeType: "sell", type: "buy", leverage: true, l: leverage, buyLeveragedPrice: leveragedPrice, orderId: orderid, orderType: "open", buyPrice: totalprice });
                        users.set(username, user);
                    }
                    else {
                        return res.json("good dev if you are here");
                    }
                }
                else {
                    return res.status(403).json("you dont have enough balance" + balance + "total price" + totalprice);
                }
            }
            else if (payload.type == "sell") {
                const orderid = payload.orderId;
                const order = user.wallet.find(o => o.orderId === orderid);
                console.log("found the order" + order);
                if (!order?.leverage) {
                    let profit = order.buyPrice - totalSellPrice;
                    balance = balance + (order.buyPrice + profit);
                    //@ts-ignore
                    user.balance = balance;
                    order.orderType = "closed";
                    order.sellPrice = totalprice;
                    users.set(username, user);
                }
                else if (order?.leverage) {
                    let buyPrice = order.buyPrice;
                    let buyleveragedPrice = order.buyLeveragedPrice;
                    if (buyleveragedPrice) {
                        let leverage = order.l;
                        let sellingleveragedPrice = currentSellPrice * qty * leverage;
                        console.log("selling leverage price" + sellingleveragedPrice);
                        let profit = buyleveragedPrice - sellingleveragedPrice;
                        balance = balance + (buyPrice + profit);
                        order.soldLeveragedPrice = sellingleveragedPrice;
                        user.balance = balance;
                        order.orderType = "closed";
                        order.sellPrice = totalprice;
                        users.set(username, user);
                    }
                    else {
                        console.log("some error happened");
                    }
                }
            }
            //@ts-ignore
            console.log(users);
            res.json("trade executed successfully  balance remaining " + user.balance + " wallet " + JSON.stringify(user.wallet) + "order total price" + totalprice);
        }
    }
});
app.get("/order/open", async (req, res) => {
    const token = req.headers.authorization;
    if (token) {
        const userDetails = jwt.verify(token, JWT_PASSWORD);
        const username = userDetails.username;
        const user = users.get(username);
        const openOrders = user?.wallet.filter(o => o.orderType == "open");
        res.json({ "open orders": openOrders });
    }
    else {
        alert("log in first");
        return;
    }
});
app.get("/order/close", async (req, res) => {
    //close the order 
    const token = req.headers.authorization;
    if (token) {
        const userDetails = jwt.verify(token, JWT_PASSWORD);
        const username = userDetails.username;
        const user = users.get(username);
        const openOrders = user?.wallet.filter(o => o.orderType == "closed");
        res.json({ "open orders": openOrders });
    }
    else {
        alert("log in first");
        return;
    }
});
app.listen(3000);
//# sourceMappingURL=index.js.map