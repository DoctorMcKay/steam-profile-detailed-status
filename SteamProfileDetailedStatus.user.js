// ==UserScript==
// @name         Steam Profile Detailed Status
// @namespace    doctormckay.com
// @description  Shows detailed status on Steam profiles, and also registration date
// @include      *://steamcommunity.com/id/*
// @include      *://steamcommunity.com/id/*/
// @include      *://steamcommunity.com/profiles/*
// @include      *://steamcommunity.com/profiles/*/
// @require      https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @require      https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.min.js
// @require      https://raw.githubusercontent.com/DoctorMcKay/steam-profile-detailed-status/master/modules.min.js
// @version      1.1.0
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_setClipboard
// @grant        GM.setClipboard
// @run-at       document-start
// ==/UserScript==

document.addEventListener('DOMContentLoaded', function() {
	if(typeof unsafeWindow.g_rgProfileData === 'undefined' || !unsafeWindow.g_rgProfileData.steamid) {
		return; // guess this isn't a profile
	}

	doStatusCheck();
    doSteamIDButton();
});

function doStatusCheck() {
    if ($('.profile_private_info').length > 0) {
		return; // private
	}

	var $online = $('.profile_in_game_header');
	if ($online.length <= 0) {
		return; // not a profile page
	}

	if (localStorage.__doctormckay_apikey) {
		getApiStatus();
	} else {
		$.get('/dev/apikey', function(html) {
			var match = html.match(/Key: ([0-9A-F]{32})/);
			if (match) {
				localStorage.__doctormckay_apikey = match[1];
				getApiStatus();
			} else {
				localStorage.__doctormckay_apikey = Date.now();
				unsafeWindow.ShowConfirmDialog("API Key Required", "You need an API key to view detailed online status. If you don't have a domain, you can use \"localhost\".", "Register Key", "Not Now").done(exportFunction(function() {
					location.href = "/dev/apikey";
				}, unsafeWindow));
			}
		});
	}

	function getApiStatus() {
		var key = localStorage.__doctormckay_apikey;
		if (!key.match || !key.match(/[0-9A-F]{32}/)) {
			// it's an ignore timestamp
			if (Date.now() - key >= (1000 * 60 * 60 * 24)) {
				delete localStorage.__doctormckay_apikey;
			}

			return;
		}

		GM.xmlHttpRequest({
			"method": "GET",
			"url": "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=" + key + "&steamids=" + unsafeWindow.g_rgProfileData.steamid,
			"onload": function(response) {
				if (!response.responseText) {
					return;
				}

				var res = JSON.parse(response.responseText);
				if (!res.response || !res.response.players || !res.response.players[0] || typeof res.response.players[0].personastate === 'undefined' || res.response.players[0].communityvisibilitystate != 3) {
					return;
				}

				var state = ["Offline", "Online", "Busy", "Away", "Snooze", "Looking to Trade", "Looking to Play"][res.response.players[0].personastate];
				if ($online.text() == "Currently Online") {
					$online.text("Currently " + state);
				} else if ($online.text() == "Currently In-Game") {
					$online.text(state + (state.indexOf("Looking to") === 0 ? "" : " and In-Game"));
				}

				if (res.response.players[0].timecreated) {
					var date = new Date(res.response.players[0].timecreated * 1000);
					var month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][date.getMonth()];
					$('.responsive_count_link_area').prepend("<p>Member since " + month + " " + date.getDate() + ", " + date.getFullYear() + "</p>");
				}
			}
		});
	}
}

function doSteamIDButton() {
    var dropdown = document.querySelector('#profile_action_dropdown .popup_body.popup_menu');
	if(dropdown) {
		// We have a dropdown
		dropdown.innerHTML += '<a class="popup_menu_item" href="javascript:OpenSteamIdDialog()"><img src="https://i.imgur.com/9MQ0ACl.png"> View SteamID</a>';
	} else {
		var actions = document.querySelector('.profile_header_actions');
		if(actions) {
			actions.innerHTML += '<a class="btn_profile_action btn_medium" href="javascript:OpenSteamIdDialog()" title="View SteamID">' +
				'<span><img src="https://i.imgur.com/9MQ0ACl.png" style="width: 16px; height: 16px; margin: 7px 0; vertical-align: top"></span></a> ';
		}
	}

	var idDialog;
	unsafeWindow.OpenSteamIdDialog = exportFunction(function() {
		unsafeWindow.HideMenu('profile_action_dropdown_link', 'profile_action_dropdown');

		var sid = new Modules.SteamID(unsafeWindow.g_rgProfileData.steamid);
		var html = '<div class="bb_h1">Click to copy</div>';
		html += '<p><a href="javascript:CopyToClipboard(\'' + sid.getSteam2RenderedID() + '\')">' + sid.getSteam2RenderedID() + '</a></p>';
		html += '<p><a href="javascript:CopyToClipboard(\'' + sid.getSteam3RenderedID() + '\')">' + sid.getSteam3RenderedID() + '</a></p>';
		html += '<p><a href="javascript:CopyToClipboard(\'' + sid.getSteamID64() + '\')">' + sid.getSteamID64() + '</a></p>';
		html += '<p><a href="javascript:CopyToClipboard(\'https://steamcommunity.com/profiles/' + sid.getSteamID64() + '\')">https://steamcommunity.com/profiles/' + sid.getSteamID64() + '</a></p>';

		idDialog = unsafeWindow.ShowAlertDialog(unsafeWindow.g_rgProfileData.personaname + "'s SteamID", html, "Close");
	}, unsafeWindow);

	unsafeWindow.CopyToClipboard = exportFunction(function(text) {
		GM.setClipboard(text);
		unsafeWindow.ShowAlertDialog("Text Copied", '"' + text + '" has been copied to your clipboard.', "OK");
		idDialog.Dismiss();
	}, unsafeWindow);
}
