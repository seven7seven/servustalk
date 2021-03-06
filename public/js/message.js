
/*=========================================================== 

  Used to process messages
  depends on config.js and helpers.js

===========================================================*/

var NO_USER = { id: ''};
var NO_MESSAGE = {
  user: NO_USER
};
var lastMessage = NO_MESSAGE;

function updateScore(message) {
    score = 0;
    uptokes = 0;
    downtokes = 0;

    if (message.downtokes != undefined && message.uptokes != undefined) {
      uptokes = message.uptokes;
      downtokes = message.downtokes;
      score = message.uptokes - message.downtokes;
    }

    $('#ts_'+message.ts).html(score);

    // Add a detailed vote counter, unless we're on the history panel
    if (!$("#messagebox").hasClass("history")) {
      $('#ts_'+message.ts).tooltip({
        placement: "top",
        title: function() { return "-" + downtokes + " +" + uptokes; },
      });
    }

    // Add a zero class if the score is 0
    if (score == 0) {
      $('#ts_'+message.ts).parent().addClass("zero");
    } else {
      $('#ts_'+message.ts).parent().removeClass("zero");
    }
}

function sendVote(message_ts, vote) {
  $.ajax({
    type: 'POST',
    url: '/vote',
    data: {vote: vote, message_ts: message_ts}
  });
}

function shakeScreen(delay) {
  if (delay === undefined)
    delay = 1000;

  $('#content').addClass('shake');

  setTimeout(function() {
    $('#content').removeClass('shake');
  }, 300)
}

function addTimestampHandler(message) {
  updateScore(message);

  $('#ts_' + message.ts + '_plus').on("click",function(e) {
    e.preventDefault();

    // If we already voted plus, remove the vote
    if ($(this).parent().hasClass("voted-plus")) {
      sendVote(message.ts, 0);
      $(this).parent().removeClass("voted-plus");
    } else {
      sendVote(message.ts, 1);
      $(this).parent().addClass("voted-plus");
    }

    // Not a 0 vote anymore
    $(this).parent().removeClass("zero");
    // Not a minus vote either
    $(this).parent().removeClass("voted-minus");
  });

  $('#ts_' + message.ts + '_minus').on("click",function(e) {
    e.preventDefault();

    // If we already voted minus, remove the vote
    if ($(this).parent().hasClass("voted-minus")) {
      sendVote(message.ts, 0);
      $(this).parent().removeClass("voted-minus");
    } else {
      sendVote(message.ts, -1);
      $(this).parent().addClass("voted-minus");
    }

    // Not a 0 vote anymore
    $(this).parent().removeClass("zero");
    $(this).parent().removeClass("voted-plus");
  });
}

function displayMessage(message, autoscroll, displayInline) {
  // TODO: figure out how we end up having message.text undefined
  if (message.type === 'TEXT' && !message.text) return;
  var wasScrolledToBottom = isScrolledToBottom();

  var html = '';

  // I <3 Checkins, Eddy
  if (message.type === 'CHECKIN') {
    html += '<div class="checkinMessage"><i class="icon-map-marker"></i><strong>' + escapeText(message.user.name) + '</strong> is at <strong><a href="http://maps.google.com/?q=' + encodeURIComponent(message.text.location) + '" target="_blank">' + escapeText(message.text.location) + '</a></strong><span class="checkin-time timestamp">' + formatTimestamp(message.ts) + '</span></div>';
    $('#messagebox .scrollr').append(html);
    if (autoscroll && wasScrolledToBottom) scrollToBottom();
    lastMessage = NO_MESSAGE;

  // Coloured messages
  } else if (message.text.indexOf('/#') == 0) { // colored alert
    var color = message.text.substring(1, message.text.indexOf(' '));
    if (!color.match(/[a-fA-F0-9]{6}|[a-fA-F0-9]{3}/g)) {
        color = '#3B5';
    }
    html += '<div class="alert" style="background: ' + color + '">';
    if (message.user.id !== 'ServusTalk') {
      // not system announcement, add user name
      html += message.user.name + ': ';
    }
    html += htmlEncode(message.text.substring(message.text.indexOf(' ') + 1))  + ' </div>';
    $('#messagebox .scrollr').append(html);
    if (autoscroll && wasScrolledToBottom) scrollToBottom();
    lastMessage = NO_MESSAGE;

  // Custom messages for /me commands
  } else if (message.text.indexOf('/me ') == 0) {
    var text = message.text.substr(4);

    html += '<div class="its-a-me">';
    html += '<span class="name">' + message.user.name + '</span> ';
    html += htmlEncode(text) +' </div>';

    $('#messagebox .scrollr').append(html);
    if (autoscroll && wasScrolledToBottom) scrollToBottom();
    lastMessage = NO_MESSAGE;
  } else {
    var userMention = '@' + $('#loggedUser').html();
    var processedMessage = processMessage(message, userMention, autoscroll && wasScrolledToBottom, displayInline);

    if (message.user.id == lastMessage.user.id && message.ts < lastMessage.ts + MAX_TIMESTAMP_DIFF ) {
      $('.author').last().append(processedMessage);
    } else {
      if (lastMessage.user.id != NO_USER.id) {
        html += '<hr/>'; 
        html += '<div style="clear: both">';
        html += '</div>';
      }
      var picture = message.user.picture ? message.user.picture : DEFAULT_PICTURE;

      html += '<img class="profilepic" src="' + picture + '"/>';
      html += '<div class="author"><strong>' + $('<div/>').text(message.user.name).html() + '</strong><span class="timestamp">' + formatTimestamp(message.ts) + '</span>';
      html += processedMessage;
      html += '</div>';
      $('#messagebox .scrollr').append(html);
    }

    memeify();
    $('code').syntaxHighlight();

    
    lastMessage = message;
    if (autoscroll && wasScrolledToBottom) {
      scrollToBottom();
    }

    // Add vote handlers
    addTimestampHandler(message);

    // Add images to the resize manager
    findAllImages();
  }
}

// lene + entuziasm
function handleQuote(html) {
    words = html.split(' ');
    if (words[0] == '/quote') {
        return $("<div>").append($('<blockquote>').html(html.substr(7))).html();
    } else {
        return html;
    }
}

function handleBlink(html) {
    words = html.split(' ');
    if (words[0] == '/blink') {
        return $("<div>").append($('<blink>').html(html.substr(6))).html();
    } else {
        return html;
    }
}

/*
 * we need to draw the canvas element only after the canvas was attached.
 * reason: (I think) it is because we attach html text instead of jquery objects
 */
function handleMeme(html) {
  memeCmd = parseMemeCmd(html);
  if (isMemeCmd(memeCmd)) {
    canvas = $('<canvas>').addClass('meme')
                          .attr('topText', memeCmd['topText'])
                          .attr('bottomText', memeCmd['bottomText'])
                          .attr('meme', memeCmd['meme'])
                          .attr('height', '150px')
                          .attr('width', '150px')
                          .attr('processed', 'false');
    return $("<div>").append(canvas.clone()).html();
  } else {
    return html;
  }
}

function processMessage(message, userMention, scroll, displayInline){
    var result = handleLinksAndEscape(message.text);
    
    // Check slap before mention
    var wasSlap = false;

    // Check if the current user was slapped
    if (isSlap(result.html, userMention)) {
      shakeScreen();
      result.html = handleSlap(result.html, userMention, message.user.name);
      wasSlap = true;
    } else {
      // Check if someone else was slapped
      if (isRemoteSlap(result.html)) {
        // Remove '/slap @'
        var slappedUser = result.html.substr(7);
        result.html = handleSlap(result.html, slappedUser, message.user.name);
      }
    }

    result.html = handleMentions(result.html, userMention, wasSlap);
    result.html = handleMeme(result.html);
    result.html = handleBlink(result.html);
    result.html = handleQuote(result.html);
    var classes = 'messageContent';

    // If this wasn't a slap, it could be a mention
    if (!wasSlap && hasMention(result.html, userMention)) {
      classes += ' mention';
    } else if (wasSlap) {
      classes += ' slap';
    }

    // Check for NSFW
    if (isNsfw(result.html, userMention)) {
      classes += ' nsfw';
      result.html = handleNsfw(result.html);
    }

    // Votes wrapper
    var votes = $('<div>').addClass("vote");

    // Downvote link
    $('<a>').attr('href',"/vote?vote=-1&message_ts='" + message.ts + "'")
            .attr('id','ts_' + message.ts + '_minus')
            .addClass('vote-minus')
            .html("-")
            .appendTo(votes);

    // Vote display
    $('<span>').attr('id',"ts_" + message.ts)
        .addClass("vote-display")
        .attr("rel","tooltip")
        .appendTo(votes);

    // Upvote link
    $('<a>').attr('href',"/vote?vote=1&message_ts='" + message.ts + "'")
            .attr('id','ts_' + message.ts + '_plus')
            .addClass('vote-plus')
            .html("+")
            .appendTo(votes);
    
    var html = '<div class="' + classes + '">' + 
                // Append the html string inside the vote div
                $('<div>').append(votes.clone()).html() + 
                // Append the processed message content
                '<div class="content">' + result.html;

    // Append embeds, still in content
    if (displayInline) {
      html += addYoutubeLinks(result.youtube);
      html += addMixcloudLinks(result.mixcloud);
      html += addSoundcloudLinks(result.soundcloud);
      html += addMp3s(result.mp3s);
      html += result.imagery;
      html += addVimeoLinks(result.vimeo);
    }

    // Close content and messageContent
    html += '</div>' + '</div>';

    return html;
}

function hasMention(text, mention) {
  return text.indexOf(mention) != -1;
}

// Checks if a message is NSFW
// For now, this means a message containing 'NSFW' in the body
function isNsfw(text) {
  return text.toLowerCase().indexOf("nsfw") != -1;
}

// Check if it begins with /slap and contains a mention to us
function isSlap(text, mention) {
  return text == ('/slap ' + mention);
}

// Check if someone else was slapped
// TODO: does not check if the user actually exists
function isRemoteSlap(text) {
  return text.indexOf('/slap @') == 0;
}

// Handles slap commands
// cafea + no QA
function handleSlap(text, mention, by) {
    return '<i>' + by + ' slapped ' + text.replace('/slap ','') + '!</i>';
}

// Adds nsfw wrapper
function handleNsfw(text) {
    return '<div class="hide-nsfw">' + text + '</div><a href="" class="btn btn-danger btn-mini show-nsfw">Show NSFW</a>';
}

function handleMentions(text, mention, wasSlap) {
    var r = new RegExp(mention, 'g');
    /*
    if (!focused && text.match(r)) {
      $('#noise').html('<embed src="' + MENTION_SOUND + '" hidden=true autostart=true loop=false>');
    }
    */

    if (wasSlap) return text.replace(r, 'you');
    return text.replace(r, '<strong>' + mention + '</strong>');
}

function formatTimestamp(ts) {
  var timestamp = new Date(ts);
  var now = new Date();
  var date;
  if (timestamp.getDate() == now.getDate() && timestamp.getMonth() === now.getMonth() && timestamp.getFullYear() == timestamp.getFullYear()) {
    date = 'Today';  
  } else {
    date = DAY_OF_WEEK[(timestamp.getDay()+6)%7] + ', ' + timestamp.getDate() + ' ' + MONTH[timestamp.getMonth()] + ' ' + timestamp.getFullYear();
  }
  var time = padTime(timestamp.getHours()) + ':' + padTime(timestamp.getMinutes()); 
  return date + ' at ' + time;
}

function padTime(number) {
  if (number < 10) {
    return '0' + number;
  }
  return number;
}

function getUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}
  

function handleLinksAndEscape(text) {

  if (text === undefined) return;

  var html = '';
  var youtube = [];
  var mixcloud = [];
  var soundcloud = [];
  var mp3s = [];
  var vimeo = [];
  var imagery = '';
  var linkMatch = /http[s]?:///g
  var index = text.search(linkMatch);
  while (index != -1) {
    textBeforeLink = text.substr(0, index);
    //html += $('<div/>').text(textBeforeLink).html();
    html += getHtmlWithSmilyes(textBeforeLink);
  var finish = index;
    while (finish < text.length && !isWhitespace(text[finish])) finish++;
    var link = text.substr(index, finish-index+1);
    if(link){
    	link = link.replace('"', '%22');
    }
    html += '<a target="_blank" href="' + link + '">' + $('<div/>').text(link).html() + '</a>';
    // check for youtube links
    var youtubeMatch = /http[s]?:\/\/(www\.)?youtube.com/g;
    if (link.search(youtubeMatch) != -1) {
      youtube.push(link); 
    };
    var mixcloudMatch = /http[s]?:\/\/(www\.)?mixcloud.com\/\w+\/\w+/g;
    if (link.search(mixcloudMatch) != -1) {
      mixcloud.push(link); 
    };
    var soundcloudMatch = /http[s]?:\/\/(www\.)?soundcloud.com/g;
    if (link.search(soundcloudMatch) != -1) {
      soundcloud.push(link); 
    };
    var youtuMatch = /http[s]?:\/\/(www\.)?youtu.be/g;
    if (link.search(youtuMatch) != -1) {
      youtube.push(link.replace(/\?/g, '&').replace(/youtu\.be\//g, 'youtube.com/watch?v='));
    };
    var vimeoMatch = /http[s]?:\/\/vimeo.com/g;
    if (link.search(vimeoMatch) == 0) {
      vimeo.push(link)
    };
    // check for imagery content
    var scrolled = isScrolledToBottom() ? ' onload="scrollToBottom()"' : '';
    imagery += '<a target="_blank" href="' + link +'"><img class="imageLink" src="' + link + '"' + scrolled + ' onerror="this.style.display = \'none\'"></img></a>';
    // check for mp3s
    if (link.substr(-4) === '.mp3') {
      mp3s.push(link);
    };
    if (finish == text.length) {
      text = '';
    } else {
      text = text.substr(finish);
    }
    index = text.search(linkMatch);
  }
  //html += $('<div/>').text(text).html();
  html += getHtmlWithSmilyes(text);
  // handle [code]snippets[/code]
  html = html.replace("/code", "<code class='highlight'>");
  
  imagery = '<div class="imageDock">' + imagery + '</div>';

  return {
    html : html,
    youtube : youtube,
    mixcloud: mixcloud,
    soundcloud: soundcloud,
    imagery : imagery,
    vimeo: vimeo,
    mp3s: mp3s,
  }
}

function paramize(text) {
  if (!text.match(/(\d\d?m)?\d\d?s/g)) {
    // nu tipa..
    console.log('paramize when parsing youtube url: ' + text);
    return '';
  };
  var time = 0;
  if (text.indexOf('m') >= 0)
    time = parseInt(text.substring(0, text.indexOf('m')));
  time = time * 60 + parseInt(text.substring(text.indexOf('m') + 1, text.indexOf('s')));
  return '&start=' + time;
}

function addYoutubeLinks(links) {
  var html = '';
  $.each(links, function(index, link) {
    var params = getUrlVars(link);
    var timestamp = params.t ? paramize(params.t) : '';
    if (params.v) {
      html += '<div class="youtube">';
      html += '<object width="420" height="315">';
      html += '  <param name="allowFullScreen" value="true"></param>';
      html += '  <embed src="https://youtube.googleapis.com/v/' + params.v + timestamp + '?fs=1"';
      html += '    type="application/x-shockwave-flash"';
      html += '    allowfullscreen="true"';
      html += '    width="420" height="315">';
      html += '  </embed>';
      html += '</object>'
      html == '</div>';
    }
  });
  return html;
}

function addSoundcloudLinks(links) {
  var html = '';
  $.each(links, function(index, link) {
    html += '<div class="soundcloud">';
    html += '<object height="81" width="100%">'; 
    html += '  <param name="movie" value="https://player.soundcloud.com/player.swf?url=' + encodeURIComponent(link) + '&amp;show_comments=true&amp;auto_play=false&amp;color=ff7700"></param>';
    html += '  <param name="allowscriptaccess" value="always"></param>';
    html += '  <embed allowscriptaccess="always" height="81" src="https://player.soundcloud.com/player.swf?url=' + encodeURIComponent(link) + '&amp;show_comments=true&amp;auto_play=false&amp;color=ff7700" type="application/x-shockwave-flash" width="100%"></embed>';
    html += '</object>';   
    html += '</div>';
  });
  return html;
}

function addMixcloudLinks(links) {
  var html = '';
  $.each(links, function(index, link) {
    html += '<div class="mixcloud">';
    html += '  <iframe width="100%" height="180" src="//www.mixcloud.com/widget/iframe/?feed=' + encodeURIComponent(link) + '&show_tracklist=&hide_cover=1&force_html=1" frameborder="0"></iframe>';
    html += '</div>';
  });
  return html;
}

function getVimeoIdFromLink(link){
  var result = "";
  var vid = link.substring(link.indexOf('.com/')+5);
  var i = 0;
  var valid = "0123456789";
  while (i<vid.length && valid.indexOf(vid[i]) != -1) {
    result += vid[i];
    i ++;
  }
  return result;
}

function addVimeoLinks(links) {
  var html = '';
  $.each(links, function(index, link) {
    video_id = getVimeoIdFromLink(link);
    html += '<iframe src="http://player.vimeo.com/video/'+video_id+'?byline=0&amp;portrait=0" width="420" height="236" frameborder="0" webkitAllowFullScreen mozallowfullscreen allowFullScreen></iframe>';
  });
  return html;
}

function addImagery(links, scroll) {
  var onload = scroll ? 'onload="scrollToBottom()"' : '';
  var html = '';
  $.each(links, function(index, link) {
    html += '<a target="_blank" href="' + link + '"><img id="imageLink" ' + onload + ' src="' + link + '"/></a>';
  });
  if (html !== '') {
    html = '<div id="imageDock">' + html + '</div>';
  }
  return html;
}

function addMp3s(links, scroll) {
  var html = '';
  $.each(links, function(index, link) {
    html += '<audio style="width: 420px" controls="controls"> <source src="' + link + '" type="audio/mp3" />';
  });
  return html;
}

function displayNotification(notification, attention, autoscroll) {
  var wasScrolledToBottom = isScrolledToBottom();
  var classes = 'notification';
  if (attention) classes += ' attention';
  var html = '<div class="' + classes + '">' + notification + '</div>';
  $('#messagebox .scrollr').append(html);
  lastMessage = NO_MESSAGE;
  if (autoscroll && wasScrolledToBottom) scrollToBottom();
}

function scrollToBottom() {
  var messagebox = $('#messagebox .scrollr');
  $(messagebox).animate({ scrollTop: $(messagebox).prop("scrollHeight") + 20 }, 0);
}

function isScrolledToBottom() {
  var elem = $('#messagebox .scrollr');
  if (elem[0].scrollHeight - elem.scrollTop() < elem.outerHeight() + 5) {
    return true;
  }
  return false;
}

function isWhitespace(ch) { 
  return " \t\n\r\v".indexOf(ch) != -1;
} 

function getUrlVars(link) {
  var vars = [], hash;
  var hashes = link.slice(link.indexOf('?') + 1).split('&');
  for(var i = 0; i < hashes.length; i++) {
    hash = hashes[i].split('=');
    vars.push(hash[0]);
    vars[hash[0]] = hash[1];
  }
  return vars;
}

function htmlEncode(value){
  return $('<div/>').text(value).html();
}

function htmlDecode(value){
  return $('<div/>').html(value).text();
}

function getHtmlWithSmilyes(text)
{
	for (var i = 0; i < EMOTICONS.length; i ++)
	{
		var pos = text.indexOf(EMOTICONS[i].code);
		if ( pos >= 0)
		{
			return getHtmlWithSmilyes(text.substring(0, pos)) + 
				getSmyleHtml(EMOTICONS[i]) + 
				getHtmlWithSmilyes(text.substring(pos+EMOTICONS[i].code.length, text.length));	}	
	}
	return htmlEncode(text);
}

function getSmyleHtml(smyle)
{
  // custom checks for text emoticons
  if (smyle.code == '\n') {
      return '<br/>';
  } else if (smyle.code == 'boian') {
    return 'ಠ_ಠ';
  }
  else if (smyle.code == 'fail' || smyle.code == 'eroare') {
    return 'buctiş';
  }
	return '<img class="emoticon" src="' + smyle.url + '" title=\'' + smyle.code + '\' alt=\'' + smyle.code + '\'/>';
}
//=========Input History=================
//  inputHistory  object is a  FIFO queue that keeps track of the list of inputs
var inputHistory = {
    _history: [""],
    _index: 0,

    push: function(cmd) {
        this._history.push(cmd);
        this._index = this.length();
    },
    length: function() {
        return this._history.length;
    },
    getNext: function() {
        this._index += 1;
        var cmd = this._history[this._index] || "";
        this._index = Math.min(this.length(), this._index);

        return cmd;
    },
    getPrev: function() {
        this._index = Math.max(0, this._index - 1);
        return this._history[this._index];
    }
};

//=========END Input History=============

// CLient side commands
function clientSideMessage(text) {
  if(text === '/meme list' || text.indexOf('/release') == 0) {
    return true;
  }
  return false;
}

function processClientSideMessage(text) {
  if(text === '/meme list') {
    wasScrolledToBottom = isScrolledToBottom();
    html = $('<div class="author">');
    for(i in ALLOWED_MEMES) {
      html.append(handleMeme('/meme ' + i + ' " " "' + i + '"'));
    }
    $('#messagebox .scrollr').append(html);
    memeify();
    lastMessage = NO_MESSAGE;
    if (wasScrolledToBottom) scrollToBottom();
  } else if (text.indexOf('/release') == 0) {
    var script = document.createElement("script");
    script.src="http://gravityscript.googlecode.com/svn/trunk/gravityscript.js";
    document.body.appendChild(script);void(0);
  }
}
