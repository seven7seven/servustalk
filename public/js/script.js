/*=========================================================== 

  General scripts
  Depends on config.js and message.js

===========================================================*/

var currentClients = [];
var first = true;
var popup;
var focused = true;
var flickeringTitle;
var originalDocTitle;
var roomTitle;
var socket;
var idle = false;
var idlePromise;
var tabHistory;
var unloading = false;
var userLocation;
var bookmark;


// On receiving new location
geolocationSuccess = function (position) {
  var lat = position.coords.latitude;
  var lng = position.coords.longitude;
  var acc = position.coords.accuracy;
  codeLatLng(lat, lng, acc)
}

// On geolocation error
geolocationError = function () {
  console.log("Geocoder failed");
}

// Sets user location when receiving a new one
codeLatLng = function (lat, lng, accuracy) {
  var latlng = new google.maps.LatLng(lat, lng);
  geocoder.geocode({'latLng': latlng}, function(results, status) {
    if (status == google.maps.GeocoderStatus.OK) {
      if (accuracy < ACCEPTABLE_ACCURACY) {
        // exact location, display all details
        userLocation = {
          lat: lat,
          lng: lng,
          location: results[0].formatted_address,
        }
      } else {
        // inexact location, display city if available and country
        for(var i in results) {
          if ($.inArray('locality', results[i].types) > -1 || $.inArray('country', results[i].types) > -1) {
            userLocation = {
              lat: lat,
              lng: lng,
              location: results[0].formatted_address,
            }
            break;
          }
        }
      }
      if(socket) {	 
        socket.emit('location', userLocation.location);
      }
    } else {
      userLocation = {
        lat: -1,
        lng: -1,
        location: 'Location unavailable',
      }
    }
  });
}

$(document).ready(function() {
  
  // Initialize the syntax highlighter
  $.SyntaxHighlighter.init({
    'lineNumbers': true,
    'baseUrl' : 'public/syntaxhighlighter',
    'themes' : ['ubutalk'],
    'theme': 'ubutalk'
  });

  // If ther's support for it, enable geolocation
  if (navigator.geolocation) {
    geocoder = new google.maps.Geocoder();

    // Set the callbacks for success and error
    navigator.geolocation.getCurrentPosition(geolocationSuccess, geolocationError);
  }

  // Load and poll the callendar
  loadCalendar(GOOGLE_CALENDAR_ATOM_FEED, 0, GOOGLE_CALENDAR_DAYS_INTERVAL);
  setInterval(function() {
    loadCalendar(GOOGLE_CALENDAR_ATOM_FEED, 0, GOOGLE_CALENDAR_DAYS_INTERVAL);
  }, GOOGLE_CALENDAR_UPDATE_INTERVAL);

  // Set a poll for idle detection
  setInterval(function() {
    refreshIdleTimes();
  }, ONE_MINUTE);

  $("a#changeTitle").click(function(e) {

    e.preventDefault();

    // Show the editable field
    $('#roomTitleEdit').show();
    $('#roomTitleDisplay').hide();

    // Set the title to the previous value
    newTitleField = $('#newTitle');
    newTitleField.val(roomTitle.text);
    newTitleField.select();
    newTitleField.focus();

  });

  $('#newTitle').live('keydown', function(e) { 
    var keyCode = e.which; 
    if (keyCode == 13 && !e.shiftKey) { // Enter
      submitTitle();
      return false;
    }
  });

  // TODO: Change to on #newTitle change
  $("#submitTitle").click(function() {
    submitTitle();
  });

  function submitTitle() {
    // Get the title
    var newTitleText = $('#newTitle').val();

    // Hide the editable field
    $('#roomTitleEdit').hide();
    $('#roomTitleDisplay').show();

    // Check if not same title
    if (newTitleText === roomTitle.text)
      return;

    // Update title
    if ($.trim(newTitleText) !== '') { 
      socket.emit('updateTitle', newTitleText);
    }

  }

  originalDocTitle = document.title;

  // Socket.io connection
  socket = io.connect('/', {
    'force new connection' : true,
    'connect timeout': 5000,
    'try multiple transports': true,
    'transports': ['websocket', 'xhr-polling'],
    'reconnect': true,
    'reconnection delay': 1000,
    'max reconnection attempts': 10
  });

  // When connecting through the socket
  socket.on('connect', function() {
    
    // Request title
    socket.emit('loadTitle');
    
    // Send location (if available)
    if (userLocation) {    
      socket.emit('location', userLocation.location);
    }

    // set focus and idle on reconnect
    if(!document.hasFocus()) {
      focus = false;
      idle = new Date().getTime();
      reportIdleness();
    }
  });

  // Socket debug helpers
  socket.on('reconnect', function(transport, attempts) {
    console.log('DEBUG: reconnect: transport=' + transport + '; attempts=' + attempts);
    window.location.reload();
  });

  socket.on('reconnecting', function(delay, attempts) {
    console.log('DEBUG: reconnecting: delay=' + delay + '; attempts=' + attempts);
  });

  socket.on('reconnect_failed', function() {
    console.log('DEBUG: reconnect_failed');
  });

  socket.on('ping', function() {
    socket.emit('pong');
  });

  // Title handling
  socket.on('loadTitle', function(title) {
    roomTitle = title;
    var result = handleLinksAndEscape(title.text);

    if ($('#roomTitle') && result) {
      $('#roomTitle').html(result.html);
    }
  });

  socket.on('updateTitle', function(title) {
    roomTitle = title;
    var result = handleLinksAndEscape(title.text);
    
    if ($('#roomTitle') && result) {
      $('#roomTitle').html(result.html);
    }
    
    displayNotification(title.user + ' changed chat title', false, true);
  });

  // NSFW show button, just removes the class
  $('.show-nsfw').live('click', function(e) {
    e.preventDefault();

    $(this).closest('.nsfw').removeClass('nsfw');
    $(this).remove();
  })

  // Handle message receiving
  socket.on('message', function(message) {
    // title flicker
    if (!focused) {
      if (flickeringTitle) clearInterval(flickeringTitle);
      flickeringTitle = setInterval(function(){
        if(document.title === originalDocTitle) {
          document.title = message.user.name + ' has messaged ...';
	      } else {
          document.title = originalDocTitle;	
        }
      }, FLICKER_TITLE_INTERVAL);
    }

    // desktop notification
    if (!focused && $('#desknot').prop('checked') && window.webkitNotifications && window.webkitNotifications.checkPermission() == 0) {
      var picture = message.user.picture ? message.user.picture : DEFAULT_PICTURE;
      if (message.type == "CHECKIN") {
        displayDesktopNotification(picture, message.user.name, message.text.location);
      } else {
        displayDesktopNotification(picture, message.user.name, message.text);
      }
    }

    displayMessage(message, true, true);
  });

  // Client handling
  socket.on('clients', function(clients) {
    // sort clients in reverse order of login time and increasing order of idle times
    var now = new Date().getTime();
    
    clients = clients.reverse().sort(function(a, b) {
      var idleA = a.idle ? a.idleFor : -1;
      var idleB = b.idle ? b.idleFor : -1;
      return idleA - idleB;
    });

    var buddylist = $('#buddylist ul');
    $(buddylist).empty();
    var nameStyle = '';
    
    if ($('#toggle').attr('full') == '0') {
       nameStyle = 'style="display: none"';
    }
    $.each(clients, function(index, client) {
      addClient(client, buddylist, nameStyle);
    });

    $('#clients-count').html(clients.length);

    if (first) {
      first = false;
    } else {
      for (var i = 0; i < currentClients.length; i++) {
        var k = 0;
        while (k < clients.length && currentClients[i].id != clients[k].id) k++;
        if (k == clients.length) {
          displayNotification(currentClients[i].name + ' disconnected', false, true);
        }
      }
      for (var i = 0; i < clients.length; i++) {
        var k = 0;
        while (k < currentClients.length && clients[i].id != currentClients[k].id) k++;
        if (k == currentClients.length) {
          displayNotification(clients[i].name + ' connected', false, true);
        }
      }
    }
    currentClients = clients;
    refreshIdleTimes();
  });

  socket.on('history', function(history) {
    $('#messagebox .scrollr').empty();
    for (index in history) {
      displayMessage(history[index], true, true);
    }
    displayNotification('Fetched latest messages sent to the room', false, true);
    scrollToBottom();
  });

  socket.on('vote', function(message) {
    updateScore(message);
  });

  socket.on('memes init', function(memes) {
    refreshMemes(memes);
  });

  socket.on('memes', function(memes) {
    displayNotification('New meme has been added', false, true);
    refreshMemes(memes);
  });

  socket.on('disconnect', function() {
    if (!unloading) {
      var message = 'You have been disconnected from server for maintenance. Please refresh and log in again.';
      displayNotification(message, true, true);
    }
  });

  function displayDesktopNotification(picture, title, text) {
      if (popup) {
        popup.cancel();
      }
      popup = window.webkitNotifications.createNotification(picture, title, text);
      popup.onclick = function() { 
        $(window).focus();
        this.cancel(); 
      };
      popup.show();
  }
  
  function refreshMemes(memes) {
    ALLOWED_MEMES = {};
    for (i in memes) {
      ALLOWED_MEMES[memes[i].keyword] = memes[i].url;
    }
  }

  $('#toggle').click(function() {
    if ($(this).attr('full') == '1') {
      $('.profilename').hide();
      $(this).attr('full', '0');
      $(this).html('&laquo;');
      $('#buddylist').css('width', '80px');
    } else {
      $('.profilename').show();
      $(this).attr('full', '1');
      $(this).html('&raquo;');
      $('#buddylist').css('width', '200px');
    }
  });

  $('#inputfield').bind('keydown', function(e) {
  	var input = $('#inputfield'); 
    var keyCode = e.which; 
    if (keyCode == 13 && !e.shiftKey) { // Enter
      var text = $.trim(input.val()); 
      input.val('');
      if (text !== '') {
      	inputHistory.push(text);//add input history
        if (text == '/clear') {
          // handle /clear command
          $('#messagebox .scrollr').html('');
          lastMessage = NO_MESSAGE;
        } else {
          if (clientSideMessage(text)) {
            processClientSideMessage(text);
          } else {
            socket.emit('message', text);
          }
        }
      }
      return false;
    }
    else if (keyCode === 38) { // KEY_UP
    	 var newVal = inputHistory.getPrev() || "";
         	 input.val(newVal);
    }
    else if (keyCode === 40) { // KEY_DOWN
    	 var newVal = inputHistory.getNext() || "";
             input.val(newVal);
    }
    else if (keyCode === 9) { // Tab
      e.preventDefault();
      if (tabHistory) {
        showTabResult();
        return false;
      }
      var index = $('#inputfield').getCursorPosition();
      var text = $('#inputfield').val();
      var left = text.substring(0, index);
      var right = text.substring(index);
      // TODO better solution for figuring out what to complete
      index = left.lastIndexOf('@');
      if (index != -1) {
        handleMentionAutoComplete(text, index, left, right);
      } else {
        if (left.indexOf('/mem') == 0) {
          handleMemeAutoComplete(text, index, left, right);
        }
      }
    } else {
      tabHistory = null;
    }
  });

  $(document).keyup(function(e) {
    switch (e.which) {
      case 27: // Esc
        $('#inputfield').focus();
        break;
      case 191: // ?
        if ($("input:text:focus").length == 0 && $("textarea:focus").length == 0) {
          $('#helpmodal').click();
        }
        break;
      default:
        break;
    }
  });

  $('#inputfield').focus();

  $('#desknot').click(function() {
    if ($(this).prop('checked') && window.webkitNotifications) {
      $('#desknot').prop('checked', false);
      window.webkitNotifications.requestPermission(function(){
        if (window.webkitNotifications.checkPermission() == 2) {
          alert('You have denied desktop notifications from ServusTalk. To unblock them, please go to Preferences -> Under the Hood -> Content Settings -> Manage Exceptions (Notifications section).');
        } else if (window.webkitNotifications.checkPermission() == 0) {
            $('#desknot').prop('checked', true);
        }
      });
    }
  });

  if(!window.webkitNotifications) {
    $('#desktop').html('Your browser does not support desktop notifications');
  } else if (window.webkitNotifications.checkPermission() == 0) {
    $('#desknot').prop('checked', true);
  }

  setInterval('blinkText()', 400);

  $('#checkin').click(function(e) {
    socket.emit('checkin', userLocation ? userLocation : '127.0.0.1');
    e.preventDefault();
  });
});

window.addEventListener('focus', function() {
  focused = true;
  $('#inputbox').focus();
  // desktop notification
  if (popup) popup.cancel();
  // flickering title
  clearInterval(flickeringTitle);
  delete flickeringTitle;
  document.title = originalDocTitle;
  // idle
  if (idle) {
    idle = false;
    reportIdleness();
  } else {
    if (idlePromise) clearTimeout(idlePromise);
  }
});

window.addEventListener('blur', function() {
  focused = false;
  var wasScrolledToBottom = isScrolledToBottom();
  // idle
  if (idlePromise) clearTimeout(idlePromise);
  idlePromise = setTimeout(function() {
    idle = new Date().getTime();
    reportIdleness();
  }, IDLE_TIMEOUT);
  if (bookmark) {
    bookmark.removeClass('bookmark');
  }
  bookmark = $(".author .messageContent .content:last")
  bookmark.addClass('bookmark');
  if (wasScrolledToBottom) scrollToBottom();
});


function reportIdleness() {
  if (idle) {
    socket.emit('idle', {since: new Date().getTime() - idle});
  } else {
    socket.emit('not idle');
  }
}

function refreshIdleTimes() {
  now = new Date().getTime();
  $('.idleSpan').each(function() {
    since = now - parseInt($(this).attr('idlesince'));
    readableTime = '';
    if (since > ONE_HOUR) {
      readableTime = Math.floor(since / ONE_HOUR) + 'h';
    } else if (since > ONE_MINUTE) {
      readableTime = Math.floor(since / ONE_MINUTE) + 'm';
    } else {
      readableTime = 'just now';
    }
    $(this).text(readableTime);
  });
}

$(window).bind('beforeunload', function() {
  unloading = true;
});

function unique(a) {
  var o = {}, i, l = a.length, r = [];
  for(i=0; i<l;i+=1) o[a[i]] = a[i];
  for(i in o) r.push(o[i]);
  return r;
};
