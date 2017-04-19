'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()

const token = "EAAJUVx9UyPwBABMFMIQuPg0ZAOhVzd3gY7DZCarR8IfpDidteitbZCUWHseNTsMkjOfeZCzOZBBmbTfpZC0oZAOJZCgA5HhUHcxOTZBAST4tgHJDPPKywlg82rcmS4r8UuMVjX9SNSVGrWhUufeCGZAYs2ZB5mgbGzJZAXUGS40H5hZArGgZDZD";
var questions = [];
var users = [];

app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
	res.send('Hello world, I am a chat bot')
})

// for Facebook verification
app.get('/webhook/', function (req, res) {
	if (req.query['hub.verify_token'] === 'my_voice_is_my_password_verify_me') {
		res.send(req.query['hub.challenge'])
	}
	res.send('Error, wrong token')
})

// Spin up the server
app.listen(app.get('port'), function() {
	console.log('running on port', app.get('port'))
})

app.post('/webhook/', function (req, res) {
    let messaging_events = req.body.entry[0].messaging
    var current_user;
    var current_answerer;
    var text;
    var original_message;
    var found = false;
    for (let i = 0; i < messaging_events.length; i++) {
	    let event = req.body.entry[0].messaging[i]
	    let sender = event.sender.id
	    if(event.postback && event.postback.payload == "GET_STARTED_PAYLOAD") {
	    	sendTextMessage(sender, "Welcome! I will help you ask and answer questions with anyone around the world. How does that sound? :)");
	    }
	    if(event.message && event.message.text) {
	    	
	    	// Find the current user
	    	for(current_user = 0; current_user < users.length; current_user++) {
			    if(users[current_user].person == sender) {
			    	found = true;
			    	break;
			    }
		   	}
		   	sleep(3000);


	    	text = event.message.text;
	    	text = text.toLowerCase();
	    	original_message = event.message.text.replace(/[&*;{}~><]/g,""); // Sanitize string 

	    	if(found == false) {
	    		promptUser(sender, users, current_user);
	    	}
	    	// User has typed "answer" or some variation of that
	    	if(found && text.includes("answer") && users[current_user].prompted == true) {
	    		giveUserQuestion(sender, users, current_user, questions);
	    	} 
	    	// User has requested to answer a question and is now answering
	    	else if(found && users[current_user].answering == true) {
	    		userAnswering(sender, users, current_user, questions);
	    	}  
	    	// User has requested to ask a question and is now asking
	    	else if(found && users[current_user].asking == true) {
	    		userAsking(sender, users, current_user, questions);
	    	} 
	    	// User has typed 'ask' or some variation of that
	    	else if(found && text.includes("ask") && users[current_user].prompted == true){
	    		userWantsToAsk(sender, users, current_user);
	    	} 
		    // If a user somehow gets here, treat them as new and ask them to ask or answer again
		    else if(found == false){
		    		promptUser(sender, users, current_user);
		    } else if(found && text.includes("answer") && users[current_user].prompted == true) {
	    		giveUserQuestion(sender, users, current_user, questions);
	    	} else {
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
    })
}

// Hacky, use callbacks in the morning
function sleep(miliseconds) {
   var currentTime = new Date().getTime();
   while (currentTime + miliseconds >= new Date().getTime()) {
   }
}

// Asks user if they want to answer a question
// Creates a new user
function promptUser(sender, users, current_user) {
	sendTextMessage(sender, "Do you want to ask or answer a question?");
	// remove repeat users
	for(var i = 0; i < users.length; i++) {
		if(users[i].person == sender) {
			users.splice(i, 1);
		}
	}
	users.push({person: sender, answerer: null, prompted: true, asking: false, answering: false});
}


//Gives the user a question to answer
function giveUserQuestion(sender, users, current_user, questions) {
	users[current_user].prompted = false;
	// If there are no questions waiting to be answered
	if(!questions[0]) {
		sendTextMessage(sender, "No questions right now. Sorry!");
		promptUser(sender, users, current_user);
	} else { // If there is a question 
		var index = 0;
		while(questions[index].asker == sender) {
	 		index++;
		}
		if(questions[index] == null) {
	 		sendTextMessage(sender, "No questions right now. Sorry!");
	 		promptUser(sender, users, current_user);
		} else {
			var question = questions[index].question;
			users[current_user].answering = true;
			questions[index].answerer = sender;
			sleep(1000);
			sendTextMessage(sender, "Please answer the following question: \n\n" + question);
		}
	}
}

// Handles when a user answers a question
function userAnswering(sender, users, current_user, questions){
	var current_answerer;
	users[current_user].answering = false;
	for(current_answerer = 0; current_answerer < users.length; current_answerer++) {
		if(questions[current_answerer].answerer == sender) {
			// Without a subscription, the bot will get banned if it messages users after 24 hours
			// of interaction. If we find a question that is 24 hours old, it must be removed.
			var cur_date = new Date();
			var question_date = questions[current_answerer].date;
			if((Math.abs(cur_date - question_date) / 36e5) >= 23.5) { // 36e5 helps convert milliseconds to hours
				question.splice(current_answerer, 1); // remove the question
				continue;
			} else {
				break;
			}
		}
	}
	sleep(3000);
	// Send message to the asker with an answer
	sendTextMessage(questions[current_answerer].asker, "You asked: " + questions[current_answerer].question + "\n \nThe answer is: " + original_message);
	// Confirm that your answer was sent.
	sendTextMessage(sender, "I just sent your answer to the asker. Thanks!");
	promptUser(sender, users, current_user);
	users[current_user].prompted = true;
	questions.shift(); // Remove question from the array
}

// Handles when a user wants to ask a question
function userWantsToAsk(sender, users, current_user) {
	users[current_user].prompted = false;
	sendTextMessage(sender, "Please ask your question.");
	users[current_user].asking = true;
}

// handles when a user asks a question
function userAsking(sender, users, current_user, questions) {
	users[current_user].asking = false;
	var cur_date = new Date();
	if(original_message.slice(-1) != '?') {
		original_message = original_message + "?"; 
	}
	questions.push({question: original_message, asker: sender, answerer: null, date: cur_date});
	sendTextMessage(sender, "Thanks, I will get back to you shortly.");
	promptUser(sender, users, current_user);
	users[current_user].prompted = true;
}