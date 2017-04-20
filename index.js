'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();

var http = require("http");
 
// NOTE ABOUT THE FOLLOWING FUNCTION:
// - I am using a free heroku app, which 'sleeps' every hour if it is not pinged
// - When someone pings it after this hour, it starts up again with a different IP address
// - Some IP addresses are blacklisted from FB, which causes my app to crash
// - By pinging it every 30 minutes, it will never sleep and the IP address will never
//   change to a blacklisted one
setInterval(function() {
    http.get("http://peaceful-caverns-10612.herokuapp.com");
}, 1800000); // 30 minutes

const token = "EAAJUVx9UyPwBABMFMIQuPg0ZAOhVzd3gY7DZCarR8IfpDidteitbZCUWHseNTsMkjOfeZCzOZBBmbTfpZC0oZAOJZCgA5HhUHcxOTZBAST4tgHJDPPKywlg82rcmS4r8UuMVjX9SNSVGrWhUufeCGZAYs2ZB5mgbGzJZAXUGS40H5hZArGgZDZD";
var questions = [];
var users = [];

app.set('port', (process.env.PORT || 5000));

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}));

// Process application/json
app.use(bodyParser.json());

// Index route
app.get('/', function (req, res) {
	res.send('Hello world, I am a chat bot');
});

// for Facebook verification
app.get('/webhook/', function (req, res) {
	if (req.query['hub.verify_token'] === 'my_voice_is_my_password_verify_me') {
		res.send(req.query['hub.challenge']);
	}
	res.send('Error, wrong token');
});

// Spin up the server
app.listen(app.get('port'), function() {
	console.log('running on port', app.get('port'));
});

app.post('/webhook/', function (req, res) {
    let messaging_events = req.body.entry[0].messaging
    var current_user;
    var current_answerer;
    var text;
    var original_message;
    var found = false;
    var user_state;
    for (let i = 0; i < messaging_events.length; i++) {
	    let event = req.body.entry[0].messaging[i];
	    let sender = event.sender.id;
	    if (event.postback && event.postback.payload == "GET_STARTED_PAYLOAD") {
	    	sendTextMessage(sender, "Welcome! I will help you ask and answer questions with anyone around the world. How does that sound? :)");
	    }
	    if (event.message && event.message.text) {
	    	
	    	// Find the current user
	    	for (current_user = 0; current_user < users.length; current_user++) {
			    if (users[current_user].person == sender) {
			    	found = true;
			    	user_state = users[current_user].state;
			    	break;
			    }
		   	}

	    	text = event.message.text;
	    	text = text.toLowerCase();
	    	original_message = event.message.text.replace(/[&*;{}~><]/g,""); // Sanitize string 
	    	
	    	// New User
	    	if (!found) {
	    		promptUser(sender, users, current_user);
	    	} else if(found && user_state == "prompted" && text != "ask" && text != "answer") {
	    		sendTextMessage(sender, "If you want to answer a question, you must type 'answer'. \n \n If you want to ask a question, you must type 'ask'");
	    	}
	    	// User has requested to answer a question and is now answering
	    	else if (found && user_state == "answering") {
	    		userAnswering(sender, users, current_user, questions, original_message);
	    	}  
	    	// User has requested to ask a question and is now asking
	    	else if (found && user_state == "asking") {
	    		userAsking(sender, users, current_user, questions, original_message);
	    	} 
	    	// User has typed 'ask' or some variation of that
	    	else if (found && text.includes("ask") && user_state == "prompted"){
	    		userWantsToAsk(sender, users, current_user);
	    	} 
		    // If a user somehow gets here, treat them as new and ask them to ask or answer again
		    else if (found && text.includes("answer") && user_state == "prompted") {
	    		giveUserQuestion(sender, users, current_user, questions);
	    	} else if (found) {
	    		promptUser(sender, users, current_user);
	    	}
	    	else {
		    	console.log("reached the end");
		    }
	    }
    }
    res.sendStatus(200)
});

function sendTextMessage(sender, text) {
    let messageData = { text:text }
    request({
	    url: 'https://graph.facebook.com/v2.9/me/messages',
	    qs: {access_token:token},
	    method: 'POST',
		json: {
		    recipient: {id:sender},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
		    console.log('Error sending messages: ', error)
		} else if (response.body.error) {
		    console.log('Error: ', response.body.error)
	    }
    });
}

// Asks user if they want to answer a question
// Creates a new user
function promptUser(sender, users, current_user) {
	sendTextMessage(sender, "Do you want to ask or answer a question?");
	// remove repeat users
	for (var i = 0; i < users.length; i++) {
		if (users[i].person == sender) {
			users.splice(i, 1);
		}
	}
	users.push({person: sender, answerer: null, state: "prompted"});
}


//Gives the user a question to answer
function giveUserQuestion(sender, users, current_user, questions) {
	// If there are no questions waiting to be answered
	if(!questions[0]) {
		sendTextMessage(sender, "No questions right now. Sorry!");
		console.log("Issue is in 1");
		setPrompt(sender, users, current_user);
	} else { // If there is a question 
		var index;
		for(index = 0; index < questions.length; index++) {
			if (questions[index].asker != sender) {
		 		break;
			} 
		}
		if (questions[index] == null || questions[index].question == null) {
	 		sendTextMessage(sender, "No questions right now. Sorry!");
	 		console.log("Issue is in 2");
	 		setPrompt(sender, users, current_user);
		} else {
			var question = questions[index].question;
			users[current_user].state = "answering";
			questions[index].answerer = sender;
			sendTextMessage(sender, "Please answer the following question: \n\n" + question);
		}
	}
}

// Handles when a user answers a question
function userAnswering(sender, users, current_user, questions, original_message) {
	var index;
	for (index = 0; index < questions.length; index++) {
		if (questions[index].answerer == sender) {
			// Without a subscription, the bot will get banned if it messages users after 24 hours
			// of interaction. If we find a question that is 24 hours old, it must be removed.
			var cur_date = new Date();
			var question_date = questions[index].date;
			if ((Math.abs(cur_date - question_date) / 36e5) >= 23.5) { // 36e5 helps convert milliseconds to hours
				questions.splice(index, 1); // remove the question
				continue;
			} else {
				break;
			}
		}
	}
	// Send message to the asker with an answer
	// It would equal null if it is a repeat question. 
	if(questions[index] && questions[index].completed == false) {
		sendTextMessage(questions[index].asker, "You asked: " + questions[index].question + "\n \nThe answer is: " + original_message);
		questions[index].completed = true;
	}
	// Confirm that your answer was sent.
	sendTextMessage(sender, "I just sent your answer to the asker. Thanks!");
	promptUser(sender, users, current_user);

	var popped_question = questions.splice(index, 1); // Remove question from the array
	popped_question.answerer = null;
	questions.push(popped_question);
	console.log(questions[questions.length - 1]);
}

// Handles when a user wants to ask a question
function userWantsToAsk(sender, users, current_user) {
	sendTextMessage(sender, "Please ask your question.");
	users[current_user].state = "asking";
}

// handles when a user asks a question
function userAsking(sender, users, current_user, questions, original_message) {
	var cur_date = new Date();
	
	if (original_message.slice(-1) != '?') {
		original_message = original_message + "?"; 
	}
	
	questions.push({question: original_message, asker: sender, answerer: null, date: cur_date, completed: false});
	sendTextMessage(sender, "Thanks, I will get back to you shortly.");
	setPrompt(sender, users, current_user);
}

function setPrompt(sender, users, current_user) {
	for (var i = 0; i < users.length; i++) {
		if (users[i].person == sender) {
			users.splice(i, 1);
		}
	}
	users.push({person: sender, answerer: null, state: "prompted"});
}