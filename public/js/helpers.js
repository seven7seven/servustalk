getProfileName = function(client, nameStyle) {
  // this line is still duplicated in getProfilePic
  // TODO: fix later its late
  var idle = client.idle ? 'idle' : '';
  var profileName = $('<span>');
  profileName.addClass('profilename');
  profileName.addClass(idle);
  profileName.addClass(nameStyle);
  profileName.html(client.name);
  return profileName;
}

getProfilePic = function(client) {
  var picture = client.picture ? client.picture : DEFAULT_PICTURE;
  var idle = client.idle ? 'idle' : '';
  var profilePic = $('<img>');
  profilePic.addClass('profilepic');
  profilePic.addClass(idle);
  profilePic.addClass('middle');
  profilePic.attr('title', client.name);
  profilePic.attr('src', picture);
  return profilePic;
}

getMockLocation = function() {
  var messages = ["20.000 leagues under the sea", "the underworld", "higher than the empire state", "moon"];
  return messages[Math.floor(Math.random() * messages.length)];
}

getProfileLocation = function(client) {
  var locationSpan = $('<span>');
  locationSpan.addClass('location');
  locationSpan.html(client.location ? client.location : getMockLocation());
  return locationSpan;
}

getProfileIdle = function(client) {
  var idleSpan = $('<span>');
  idleSpan.addClass('idleSpan');
  idleSpan.attr('idleSince', (new Date().getTime() - client.idleFor));
  var idleSince = client.idle ? idleSpan : '';
  return idleSince;
}

addClient = function(client, buddylist, nameStyle) {
  var profilePic = getProfilePic(client);
  var profileName = getProfileName(client, nameStyle);
  var profileLocation = getProfileLocation(client);
  var idleSince = getProfileIdle(client);

  var li = $('<li>');
  li.append(profilePic);
  li.append(profileName);
  li.append(idleSince);
  li.append(profileLocation);
  
  var inputField = $('textarea#inputfield');

  // When clicking a user in the buddy list, mention that user and focus
  li.on('click', function() {
    inputField.val(inputField.val() + '@' + client.name + ' ');
    inputField.setCursorPosition(inputField.val().length).focus();
  });

  buddylist.append(li);
}
