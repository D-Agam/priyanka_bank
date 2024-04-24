const express = require("express");
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const { connectToDb, getDb } = require('./db');
const { ObjectId } = require("mongodb");
const { name } = require("ejs");
app.use(express.static('public'));
let db;
connectToDb((err) => {
    if (!err) {
        app.listen(3000, () => {
            console.log("Server is running on port 3000");
        });
        db = getDb();
    } else {
        console.log("No connection");
    }
});
app.get('/', (req, res) => {
    res.render('login.ejs',{msg:" "});
});
app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    console.log("In login");
    console.log(username);
    console.log(password);
    db.collection('logindb')
        .findOne({
            $and: [
                { username: username },
                { password: password },
                { password: { $exists: true, $ne: "" } }, 
                { username: { $exists: true, $ne: "" } }, 
                { $expr: { $gte: [{ $strLenCP: password }, 8] } } 
            ]
        })
        .then((user) => {
            if (!user) {
                console.log("Please verify your details!"); 
                return res.status(404).render('login.ejs', { msg: "Please verify your details" });
            }
            
            console.log("Welcome to our banking service"); 
            res.status(200).render('home.ejs');
        })
        .catch((error) => {
            console.error("Error occurred while querying the database:", error); 
            res.status(500).json({ error: "Internal server error." });
        });
});
app.get('/open_account', (req, res) => {
    res.render('open_account.ejs',{msg:""});
});
app.post('/open_account', (req, res) => {
    const accountType = req.body.accountType;
    const employeeId = req.body.employeeId;
    const name = req.body.username;
    const nominee = req.body.nominee;
    const accountId = req.body.accountId;
    const validId = req.body.validId;
    const income = req.body.income;

    db.collection('customer')
        .findOne({
            customer_name: name,
            account_type: accountType,
            nominee: nominee,
            account_id: accountId,
            govt_id: validId,
            annual_income: income
        })
        .then((existingCustomer) => {
            if (existingCustomer) {
                console.log("Customer with the same details already exists!");
                return res.status(400).json({ error: "Customer with the same details already exists." });
            } else {
                db.collection('logindb')
                    .findOne({ employee_id: employeeId })
                    .then((user) => {
                        if (!user) {
                            console.log("Please verify your details!");
                            return res.status(404).render('open_account.ejs', { msg: "Please verify your details" });
                        }
                        db.collection('customer').insertOne({
                            customer_name: name,
                            account_type: accountType,
                            nominee: nominee,
                            account_id: accountId,
                            govt_id: validId,
                            annual_income: income
                        })
                            .then(() => {
                                console.log("Account opened successfully");
                                res.send("Account opened successfully");
                            })
                            .catch((error) => {
                                console.error("Error occurred while inserting customer data:", error);
                                res.status(500).json({ error: "Failed to open account." });
                            });
                    })
                    .catch((error) => {
                        console.error("Error occurred while querying the database for user:", error);
                        res.status(500).json({ error: "Internal server error." });
                    });
            }
        })
        .catch((error) => {
            console.error("Error occurred while querying the database for existing customer:", error);
            res.status(500).json({ error: "Internal server error." });
        });
});

app.get('/add_money', (req, res) => {
    res.render('add_money.ejs',{msg:""});
});
app.post('/add_money', (req, res) => {
    const accountType = req.body.accountType;
    const employeeId = req.body.employeeId;
    const name = req.body.username;
    const accountId = req.body.accountId;
    const amount = parseInt(req.body.amount);
    const transactionDate = new Date(); // Current date and time
    const by="self added money";
    db.collection('logindb').findOne({ employee_id: employeeId })
        .then((user) => {
            if (!user) {
                console.log("Please verify your details!");
                return res.status(404).render('add_money.ejs', { msg: "Please verify your details" });
            }

            db.collection('customer').updateOne(
                {
                    account_type: accountType,
                    customer_name: name,
                    account_id: accountId
                },
                { $inc: { balance: amount } }
            )
            .then(() => {
                console.log(amount, "added successfully");

                // Insert transaction details into the "transaction" collection
                db.collection('transaction').insertOne({
                    account_type: accountType,
                    customer_name: name,
                    account_id: accountId,
                    transaction_by:by,
                    amount: amount,
                    date: transactionDate
                })
                .then(() => {
                    console.log("Transaction added successfully");
                    res.send("Money added successfully");
                })
                .catch((error) => {
                    console.error("Error occurred while adding transaction:", error);
                    res.status(500).json({ error: "Internal server error." });
                });
            })
            .catch((error) => {
                console.error("Error occurred while updating balance:", error);
                res.status(500).json({ error: "Internal server error." });
            });
        })
        .catch((error) => {
            console.error("Error occurred while querying the database:", error);
            res.status(500).json({ error: "Internal server error." });
        });
});

app.get('/withdraw_money', (req, res) => {
    res.render('withdraw_money.ejs',{msg:""});
});
app.post('/withdraw_money', (req, res) => {
    const accountType = req.body.accountType;
    const employeeId = req.body.employeeId;
    const name = req.body.username;
    const accountId = req.body.accountId;
    const amount = -1*parseInt(req.body.amount);
    const by="self withdrawn money";
    db.collection('logindb')
        .findOne({ employee_id: employeeId })
        .then((user) => {
            if (!user) {
                console.log("Please verify your details!");
                return res.status(404).render('withdraw.ejs', { msg: "Please verify your details" });
            }

            db.collection('customer')
                .findOne({
                    account_type: accountType,
                    customer_name: name,
                    account_id: accountId,
                    balance: { $gte: amount } 
                })
                .then((customer) => {
                    if (!customer) {
                        console.log("Insufficient balance!");
                        return res.status(400).json({ error: "Insufficient balance" });
                    }

                    db.collection('customer')
                        .updateOne(
                            {
                                account_type: accountType,
                                customer_name: name,
                                account_id: accountId
                            },
                            { $inc: { balance: amount } } 
                        )
                        .then(() => {
                            console.log(amount, "withdrawn successfully");

                            // Add transaction to 'transaction' collection
                            const transaction = {
                                account_type: accountType,
                                customer_name: name,
                                account_id: accountId,
                                transaction_by:by,
                                amount: amount, // negative amount for withdrawal
                                date: new Date() // current date
                            };

                            db.collection('transaction').insertOne(transaction)
                                .then(() => {
                                    console.log("Transaction added successfully");
                                    res.send("Money withdrawn successfully");
                                })
                                .catch((error) => {
                                    console.error("Error occurred while adding transaction:", error);
                                    res.status(500).json({ error: "Internal server error." });
                                });
                        })
                        .catch((error) => {
                            console.error("Error occurred while updating balance:", error);
                            res.status(500).json({ error: "Internal server error." });
                        });
                })
                .catch((error) => {
                    console.error("Error occurred while querying the database:", error);
                    res.status(500).json({ error: "Internal server error." });
                });
        })
        .catch((error) => {
            console.error("Error occurred while querying the database:", error);
            res.status(500).json({ error: "Internal server error." });
        });
});


app.get('/transfer_money', (req, res) => {
    res.render('transfer_money.ejs',{msg:""});
});
app.post('/transfer_money', (req, res) => {
    const acc_type = req.body.accountType;
    const e_id = req.body.employeeId;
    const name = req.body.username;
    const account_id = req.body.accountId;
    const rec_name = req.body.rec_name;
    const rec_id = req.body.rec_accountId;
    const amount = parseInt(req.body.amount); // Convert amount to a floating-point number
    const by = name;

    if (amount <= 0) {
        return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    // Check if the employee ID is valid
    db.collection('logindb').findOne({ employee_id: e_id })
        .then((employee) => {
            if (!employee) {
                return res.status(400).json({ error: "Invalid employee ID" });
            }

            // Retrieve sender's account details and check balance
            db.collection('customer').findOne({ 
                account_id: account_id,
                account_type: acc_type,
                balance: { $gte: amount } // Check if balance is greater than or equal to the amount
            })
                .then((sender) => {
                    if (!sender) {
                        return res.status(400).json({ error: "Insufficient balance" });
                    }

                    // Update sender's balance
                    db.collection('customer').updateOne(
                        { account_id: account_id },
                        { $inc: { balance: -amount } } // Decrease balance in sender's account
                    )
                        .then(() => {
                            // Increase recipient's balance
                            db.collection('customer').updateOne(
                                { account_id: rec_id },
                                { $inc: { balance: amount } } // Increase balance in recipient's account
                            )
                                .then(() => {
                                    // Prepare transaction object for sender
                                    const senderTransaction = {
                                        customer_name: name,
                                        account_id: account_id,
                                        recipient_name: rec_name,
                                        recipient_account_id: rec_id,
                                        amount: -amount,
                                        date: new Date(), // Current date
                                        transaction_by: "transferred by self" // Indicate sender initiated the transaction
                                    };

                                    // Prepare transaction object for recipient
                                    const recipientTransaction = {
                                        sender_name: name,
                                        sender_account_id: account_id,
                                        customer_name: rec_name,
                                        account_id: rec_id,
                                        amount: amount,
                                        date: new Date(), // Current date
                                        transaction_by: "received money by transfer" // Indicate recipient received the transaction
                                    };

                                    // Insert transactions for sender and recipient
                                    db.collection('transaction').insertMany([senderTransaction, recipientTransaction])
                                        .then(() => {
                                            return res.status(200).json({ message: "Money transferred successfully" });
                                        })
                                        .catch((error) => {
                                            console.error("Error adding transactions:", error);
                                            return res.status(500).json({ error: "Internal server error" });
                                        });
                                })
                                .catch((error) => {
                                    console.error("Error transferring money to recipient:", error);
                                    return res.status(500).json({ error: "Internal server error" });
                                });
                        })
                        .catch((error) => {
                            console.error("Error transferring money from sender:", error);
                            return res.status(500).json({ error: "Internal server error" });
                        });
                })
                .catch((error) => {
                    console.error("Error retrieving sender account details:", error);
                    return res.status(500).json({ error: "Internal server error" });
                });
        })
        .catch((error) => {
            console.error("Error checking employee ID:", error);
            return res.status(500).json({ error: "Internal server error" });
        });
});




app.get('/view_summary', (req, res) => {
    res.render('view_summary.ejs');
});
app.post('/view_summary', (req, res) => {
    const filter = req.body.filterType;
    const timestamp = req.body.timeFilter;
    const e_id = req.body.employeeId;
    const name = req.body.username;
    const acc_id = req.body.accountId;

    // Calculate the date based on the timestamp provided by the user
    const currentDate = new Date();
    const cutoffDate = new Date(currentDate.getTime() - (timestamp * 24 * 60 * 60 * 1000));

    if (filter === "credit") {
        db.collection('logindb').findOne({ employee_id: e_id })
            .then((employee) => {
                if (!employee) {
                    return res.status(404).json({ error: "Employee ID not found" });
                }

                db.collection('transaction').find({ 
                    $and: [
                        { customer_name: name }, 
                        { amount: { $gt: 0 } }, 
                        { account_id: acc_id }, 
                        { date: { $gt: cutoffDate } } 
                    ]
                })
                    .toArray()
                    .then((credit_hist) => {
                        return res.status(200).json({ history: credit_hist });
                    })
                    .catch((error) => {
                        console.error("Error fetching credit history:", error);
                        return res.status(500).json({ error: "Internal server error" });
                    });
            })
            .catch((error) => {
                console.error("Error checking employee ID:", error);
                return res.status(500).json({ error: "Internal server error" });
            });
    } else if (filter === "debit") {
        db.collection('logindb').findOne({ employee_id: e_id })
            .then((employee) => {
                if (!employee) {
                    return res.status(404).json({ error: "Employee ID not found" });
                }

                db.collection('transaction').find({ 
                    $and: [
                        { customer_name: name }, 
                        { amount: { $lt: 0 } }, 
                        { account_id: acc_id }, 
                        { date: { $gt: cutoffDate } } 
                    ]
                })
                    .toArray()
                    .then((debit_hist) => {
                        return res.status(200).json({ history: debit_hist });
                    })
                    .catch((error) => {
                        console.error("Error fetching debit history:", error);
                        return res.status(500).json({ error: "Internal server error" });
                    });
            })
            .catch((error) => {
                console.error("Error checking employee ID:", error);
                return res.status(500).json({ error: "Internal server error" });
            });
    } else if (filter === "meeting") {
        db.collection('logindb').findOne({ employee_id: e_id })
            .then((employee) => {
                if (!employee) {
                    return res.status(404).json({ error: "Employee ID not found" });
                }

                db.collection('meeting').find({ 
                    $and: [
                        { customer_name: name }, 
                        { account_id: acc_id }, 
                        { appointment_date: { $gt: cutoffDate } } 
                    ]
                })
                    .toArray()
                    .then((meeting_hist) => {
                        return res.status(200).json({ history: meeting_hist });
                    })
                    .catch((error) => {
                        console.error("Error fetching meeting history:", error);
                        return res.status(500).json({ error: "Internal server error" });
                    });
            })
            .catch((error) => {
                console.error("Error checking employee ID:", error);
                return res.status(500).json({ error: "Internal server error" });
            });
    } else {
        return res.status(400).json({ error: "Invalid filter type" });
    }
});




app.get('/book_meeting', (req, res) => {
    res.render('book_meeting.ejs',{msg:""});
});
app.post('/book_meeting', (req, res) => {
    const e_id = req.body.employeeId;
    const name = req.body.username;
    const acc_id = req.body.accountId;
    const date = new Date(req.body.appointment_date); // Parse the appointment date
    const reason = req.body.reason;

    // Check if the appointment date is after the current date
    const currentDate = new Date();
    if (date <= currentDate) {
        return res.status(400).json({ error: "Appointment date must be after the current date" });
    }

    // Check if the employee ID exists in the logindb collection
    db.collection('logindb').findOne({ employee_id: e_id })
        .then((employee) => {
            if (!employee) {
                return res.status(404).json({ error: "Employee ID not found" });
            }

            // Check if the employee's name and account ID exist in the customer collection
            db.collection('customer').findOne({
                customer_name: name,
                account_id: acc_id
            })
            .then((customer) => {
                if (!customer) {
                    return res.status(404).json({ error: "Customer details not found" });
                }

                // Check if the manager has less than 5 meetings booked on the given date
                db.collection('meetings').countDocuments({
                    employee_id: e_id,
                    appointment_date: date
                })
                .then((count) => {
                    if (count >= 5) {
                        return res.status(400).json({ error: "Manager has reached the maximum number of meetings for this date" });
                    }

                    // Book the meeting if all conditions are met
                    // Insert transaction into the 'meetings' collection
                    const transaction = {
                        employee_id: e_id,
                        appointment_date: date,
                        reason: reason,
                        customer_name: name,
                        customer_id: customer._id // Assuming you have a customer ID field in the 'customer' collection
                        // Add other meeting details here
                    };

                    db.collection('meetings').insertOne(transaction)
                        .then(() => {
                            return res.status(200).json({ message: "Meeting booked successfully" });
                        })
                        .catch((error) => {
                            console.error("Error adding meeting:", error);
                            return res.status(500).json({ error: "Internal server error" });
                        });
                })
                .catch((error) => {
                    console.error("Error checking meeting count:", error);
                    return res.status(500).json({ error: "Internal server error" });
                });
            })
            .catch((error) => {
                console.error("Error checking customer details:", error);
                return res.status(500).json({ error: "Internal server error" });
            });
        })
        .catch((error) => {
            console.error("Error checking employee ID:", error);
            return res.status(500).json({ error: "Internal server error" });
        });
});
