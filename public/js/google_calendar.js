
/*=========================================================== 

  Calendar functionality
  
  Depends on config.js

===========================================================*/


/* Calendar output variables */
var days_to_show = 30;

/* Loads the Google data JavaScript client library */
google.load("gdata", "1");

function init() {
  // init the Google data JS client library with an error handler
  google.gdata.client.init(handleGDError);
  //loadTestCalendar();
}

if(!String.linkify) {
  String.prototype.linkify = function() {

    // http://, https://, ftp://
    var urlPattern = /\b(?:https?|ftp):\/\/[a-z0-9-+&@#\/%?=~_|!:,.;]*[a-z0-9-+&@#\/%=~_|]/gim;

    // www. sans http:// or https://
    var pseudoUrlPattern = /(^|[^\/])(www\.[\S]+(\b|$))/gim;

    // Email addresses
    var emailAddressPattern = /\w+@[a-zA-Z_]+?(?:\.[a-zA-Z]{2,6})+/gim;

    return this
      .replace(urlPattern, '<a target="_blank" href="$&">$&</a>')
      .replace(pseudoUrlPattern, '$1<a target="_blank" href="http://$2">$2</a>')
      .replace(emailAddressPattern, '<a target="_blank" href="mailto:$&">$&</a>');
  };
}

/**
 * Adds a leading zero to a single-digit number.  Used for displaying dates.
 */
function padNumber(num) {
  if (num <= 9) {
    return "0" + num;
  }
  return num;
}

function mapDay(day_num) {
  // Google Calendar week starts on Sunday
	return DAY_OF_WEEK[(day_num+6)%7];
}

function mapMonth(day_num) {
	return MONTH[day_num];
}

function extractTime(date) {
	var hours = date.getHours();
	var minutes = date.getMinutes();
	var time = "";
	var ampm = "am";
	
	if (minutes < 10){
		minutes = "0" + minutes;
	}
	
	if (hours == 0){
		hours = 12;
	}
	else if(hours > 11){
		ampm = "pm";
		if (hours != 12) {
			hours -= 12;
		}
	} 
	
	if (minutes == "00") {
		time = hours + ampm;
	}
	else {
		time = hours + ":" + minutes + ampm;
	}
	return time;
}

/**
 * Determines the full calendarUrl based upon the calendarAddress
 * argument and calls loadCalendar with the calendarUrl value.
 *
 * @param {string} calendarAddress is the email-style address for the calendar
 */ 
function loadCalendarByAddress(calendarAddress) {
  var calendarUrl = 'http://www.google.com/calendar/feeds/' +
                    calendarAddress + 
                    '/public/full';
  loadCalendar(calendarUrl);
}

/**
 * Uses Google data JS client library to retrieve a calendar feed from the specified
 * URL.  The feed is controlled by several query parameters and a callback 
 * function is called to process the feed results.
 *
 * @param {string} calendarUrl is the URL for a public calendar feed
 */  
function loadCalendar(calendarUrl, hours, days) {
  var service = new google.gdata.calendar.CalendarService('gcal-loader');
  var query = new google.gdata.calendar.CalendarEventQuery(calendarUrl);
  
  query.setOrderBy('starttime');
  query.setSortOrder('ascending');
  query.setSingleEvents(true);

  /* set min and max date */
  var minDate = new Date();
  minDate.setHours(minDate.getHours() - hours); 
  var maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + days);  //add days offset
  
  var gMinDate = new google.gdata.DateTime(minDate);
  var gMaxDate = new google.gdata.DateTime(maxDate);
  
  query.setMinimumStartTime(gMinDate);
  query.setMaximumStartTime(gMaxDate);

  service.getEventsFeed(query, listEvents, handleGDError);
}

/**
 * Callback function for the Google data JS client library to call when an error
 * occurs during the retrieval of the feed.  Details available depend partly
 * on the web browser, but this shows a few basic examples. In the case of
 * a privileged environment using ClientLogin authentication, there may also
 * be an e.type attribute in some cases.
 *
 * @param {Error} e is an instance of an Error 
 */
function handleGDError(e) {
  console.log(e.toString());
}

function isToday(date) {
  var now = new Date();
  if (now.getDate() == date.getDate() && date.getMonth() == now.getMonth()) {
    return true;
  }
  return false;
}

/**
 * Callback function for the Google data JS client library to call with a feed 
 * of events retrieved.
 *
 * Creates an unordered list of events in a human-readable form.  This list of
 * events is added into a div called 'events'.  The title for the calendar is
 * placed in a div called 'calendarTitle'
 *
 * @param {json} feedRoot is the root of the feed, containing all entries 
 */ 
function listEvents(feedRoot) {
  var entries = feedRoot.feed.getEntries();
  var eventDiv = document.getElementById('events');
  if (eventDiv.childNodes.length > 0) {
    eventDiv.removeChild(eventDiv.childNodes[0]);
  }	  
  
  /* set the calendarTitle div with the name of the calendar */
  if (document.getElementById('calendarTitle') != null) {
  	document.getElementById('calendarTitle').innerHTML = "<p class=\"calendar_title\">" + feedRoot.feed.title.$t + "<p>";
  }  
  
  eventDiv.innerHTML = '';
  /* loop through each event in the feed */
  var len = entries.length;
  for (var i = 0; i < len; i++) {
    var entry = entries[i];
    var title = entry.getTitle().getText();
    var startDateTime = null;
    var startJSDate = null;
    var times = entry.getTimes();
    if (times.length > 0) {
      startDateTime = times[0].getStartTime();
      startJSDate = startDateTime.getDate();
      endDateTime = times[0].getEndTime();
      endJSDate = endDateTime.getDate();
    }
    var entryLinkHref = null;
    if (entry.getHtmlLink() != null) {
      entryLinkHref = entry.getHtmlLink().getHref();
    }
    
    /* Parse out the Date String */
    var dateString = mapDay(startJSDate.getDay()) + ", ";
    dateString += startJSDate.getDate() + ' ' + mapMonth(startJSDate.getMonth()); 
    // + " " + startJSDate.getFullYear();
    if (isToday(startJSDate)) {
      dateString = 'Today';
    }
    dateMinusOneDay = new Date(startJSDate);
    dateMinusOneDay.setDate(dateMinusOneDay.getDate() - 1);
    if (isToday(dateMinusOneDay)) {
      dateString = 'Tomorrow';
    }
    
    /* Parse out the Time string */
    var timeString = "";
    if (!startDateTime.isDateOnly()) {
      timeString += ', ';
    	timeString += extractTime(startJSDate); // +  " - " + extractTime(endJSDate);
    }
    	
    /* Parse out the Location */
    var locationString = entry.getLocations()[0].getValueString();
    
    /* Parse out the description */
    var descriptionString = entry.getContent().getText();
    //descriptionString = descriptionString.replace("\n", "<br>")
    
    // Create a 'p' element for this event
    var pEvent = document.createElement('p');
    pEvent.setAttribute('class', "event_listing");
    
    // Add Event title 
    var titleSpan = document.createElement('span');
    titleSpan.setAttribute('class', "event_title");
    /* if we have a link to the event, create an 'a' element */
    if (entryLinkHref != null) {
      entryLink = document.createElement('a');
      entryLink.setAttribute('href', entryLinkHref);
      entryLink.setAttribute('target', "_blank");
      entryLink.appendChild(document.createTextNode(title));
      titleSpan.appendChild(entryLink);
    } 
    else {
      titleSpan.appendChild(document.createTextNode(title));
    }
    pEvent.appendChild(titleSpan);
    // Add Event Date
    if (dateString != "") {
    	var dateSpan = document.createElement('span');
    	dateSpan.setAttribute('class', "event_date");
    	dateSpan.appendChild(document.createElement('br'));
    	dateSpan.appendChild(document.createTextNode(dateString + timeString))
    	pEvent.appendChild(dateSpan);
    }
    // Add Event Location
    if (locationString != "") {
    	var locationSpan = document.createElement('span');
    	locationSpan.setAttribute('class', "event_location");
    	locationSpan.appendChild(document.createElement('br'));
    	locationSpan.appendChild(document.createTextNode('@' + locationString));
    	pEvent.appendChild(locationSpan);
    }
    // Add Event Description 
    if (descriptionString != "") {
    	var descriptionSpan = document.createElement('span');
    	descriptionSpan.setAttribute('class', "event_description");
    	descriptionSpan.appendChild(document.createElement('br'));
    	//descriptionSpan.innerHtml = descriptionString
    	descriptionArray = descriptionString.split("\n");
      for (var each in descriptionArray) {
        if (each > 0) descriptionSpan.appendChild(document.createElement('br'));
        textNode = document.createElement('span');
        textNode.innerHTML = descriptionArray[each].linkify();
    		descriptionSpan.appendChild(textNode);
    	}
    	pEvent.appendChild(descriptionSpan);
    } 
    /* append the list item onto the unordered list */
    eventDiv.appendChild(pEvent);
  }
}

google.setOnLoadCallback(init);
