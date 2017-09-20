
var GAME_SPELL_CHECKER_URL = "./server/spell_check.php";

var GAME_NUM_CELLS_PER_SIDE = 15;
var GAME_NUM_LETTERS_PER_PLAYER = 7;
var GAME_SAVES_LOCALSTORAGE_PREFIX = 'scrabble_save_';
var GAME_GLOBAL_LOCALSTORAGE_PREFIX = 'scrabble_global_';

var Game = {
	settings: {
		game_lang: "french",
	},

	game_name: null,
	distribution_data: {},
	lang_data: {},
	current_cells_value: {},
	game_letters_pool: {},

	players: [],
	current_playing_player: null,
	current_turn: 0,

	root_node: null,
	board_node: null,
	last_hovered_cell_node: null,
	app_already_initiated: false,
	screen_loading_callbacks: {},

	special_tiles: {}, // Calculated in init()

	history_repository: [],

	/***************
	* INIT METHODS *
	****************/

	show_notice_popup: function(type, message) {
		/* @TODO: Better Notice Popups (errors, infos, etc...) */

		alert(type + ': ' + message);
	},

	show_confirm_popup: function(message, on_confirm, on_cancel) {
		/* @TODO: Better Confirm Popups (errors, infos, etc...) */

		if( confirm(message) ) {
			on_confirm();
		} else if( on_cancel ) {
			on_cancel();
		}
	},

	before_screen_show: function(screen_selector, callback) {
		if( ! Game.screen_loading_callbacks[screen_selector] ) {
			Game.screen_loading_callbacks[screen_selector] = [];
		}

		Game.screen_loading_callbacks[screen_selector].push(callback);
	},

	set_screen(screen_selector) {
		var target_screen_element = document.querySelector(screen_selector);

		if( target_screen_element ) {
			var show_screen = true;

			var screen_callbacks = Game.screen_loading_callbacks[screen_selector];
			if( screen_callbacks && screen_callbacks.length ) {
				for(var i = 0; i < screen_callbacks.length; i++) {
					if( screen_callbacks[i]() === false ) {
						show_screen = false;
					}
				}
			}

			if( show_screen ) {
				document.querySelector('.screen.current').classList.remove('current');
				target_screen_element.classList.add('current');

				document.location.hash = target_screen_element.getAttribute('id');
			}
			
		} else {
			console.error('Can\'t find any element with selector "'+screen_selector+'"');
		}
	},

	init_global_game_screens: function() {

		/* Setup screens navigation listeners */
		var screenLinks = document.querySelectorAll('.screen .screen-link');
		for(var i = 0; i < screenLinks.length; i++) {
			screenLinks[i].addEventListener('click', function(event) {
				event.preventDefault();
				
				var screen_selector = event.target.getAttribute('href');
				Game.set_screen(screen_selector);

			}, false);
		};

		/* Load saved games titles and show them on the load-game screen on screen load */
		Game.before_screen_show('#load-game-screen', function() {
			var list_of_saved_games = '';
			var game_key_match_regexp = new RegExp('^' + GAME_SAVES_LOCALSTORAGE_PREFIX + '(.+)');

			for(var key in localStorage) {
				var reg_checker = key.match(game_key_match_regexp);
				if(reg_checker) {
					list_of_saved_games += '<div class="player-saved-game-wrapper">'+
												'<a href="#" data-loader data-save-id="'+reg_checker[1]+'">'+reg_checker[1]+'</a>'+
												' <small><a href="#" data-deleter data-save-id="'+reg_checker[1]+'">(Delete)</a></small>'+
											'</div>';
				}
			}

			if( list_of_saved_games ) {
				document.querySelector('#load-game-screen .screen-content').innerHTML = list_of_saved_games;
				return true;
			} else {
				Game.show_notice_popup('error', 'No saved game found');
				return false;
			}
		});


		/* Setup new game button listener */
		document.getElementById('button-start-new-game').addEventListener('click', function(event) {
			event.preventDefault();
			
			var game_name = document.getElementById('new-game-game-name').value;

			if( (! game_name) || game_name.match(/^\s+/) || game_name.length > 40 ) {
				Game.show_notice_popup('error', 'The game name you chose is not valid (Can\'t be empty, start with spaces or contain more than 40 characters)');
				return;
			}
			
			var new_game_closure = (function(game_name) {
				return function() {
					var list_of_players = [];

					for(var i = 0; i < 4; i ++) {
						var input_id = 'new-game-player-name-' + (i + 1);
						var player_name = document.getElementById(input_id).value;

						if(player_name) {
							list_of_players.push({name: player_name, active: true});
						}
					}

					if( list_of_players.length < 2 ) {
						Game.show_notice_popup('error', 'This game requires at least two players');
						return;
					}

					Game.start_new_game(list_of_players, game_name);
					Game.set_screen('#game-screen');
				};
			}) (game_name);

			/* Confirm user wants to overwrite if game name already used */
			var check_existing_game_name = localStorage.getItem(GAME_SAVES_LOCALSTORAGE_PREFIX + game_name);
			if( check_existing_game_name !== null ) {
				Game.show_confirm_popup('You are about to overwrite a previous save with the same name. Do you want to proceed ?', function() {
					new_game_closure();
				}, function() {
					document.getElementById('new-game-game-name').value = '';
				});
			} else {
				new_game_closure();
			}

			

		}, false);



		/* Setup click on saved game links in load game screen */
		/* Suppression and opening of saved games is handled here */
		document.getElementById('load-game-screen').addEventListener('click', function(event) {
			var click_target = event.target;

			if(click_target.hasAttribute('data-save-id')) {
				event.preventDefault();
				var save_id = click_target.getAttribute('data-save-id');

				if( click_target.hasAttribute('data-loader') ) {
				    Game.load_game_save(save_id);
				    Game.set_screen('#game-screen');
				} else if( click_target.hasAttribute('data-deleter') ) {
					(function(save_id) {
						Game.show_confirm_popup('Are you sure you wanna delete this save ? It will be definitely erased !', function() {
							Game.delete_game_save(save_id);
							Game.set_screen('#load-game-screen');
						});
					}) (save_id);
					return;
				}
			    
			}
		}, false);


		/* If there is a screen's hash in the URL, open it directly. If it's the game-screen, load previously loaded game-save */
		/* @TODO: Handle history navigation (click on prev/next buttons of the browser) */
		var hash = document.location.hash;
		if( hash ) {
			if( hash == "#game-screen" ) {
				var last_game_name = localStorage.getItem(GAME_GLOBAL_LOCALSTORAGE_PREFIX + 'last_game_name');
				if( last_game_name ) {
					Game.load_game_save(last_game_name);
					Game.set_screen('#game-screen');
				} else {
					Game.set_screen('#title-screen');
				}
				return;
			}

			Game.set_screen(hash);
		}
	},

	init_player_data: function(players_data, is_loading) {
		if( ! players_data || obj_is_empty(players_data) || ! (players_data instanceof Array) || players_data.length < 2 ) {
			console.error("Game.init_player_data() expects an array of objects defining players as its second argument. The array must have at least 2 elements.");
			return false;
		}

		Game.players = players_data;

		for(var i = 0; i < Game.players.length; i++) {
			if( ! is_loading ) {
				Game.players[i].id = i;
				Game.players[i].current_score = 0;
				Game.players[i].letters_pool = [];
				Game.players[i].next_player_id = ( (i + 1) < Game.players.length ? (i + 1) : 0 );
			}
			
			Game.players[i].current_word_direction = null;
			Game.players[i].current_played_words = "";
			Game.players[i].current_played_cells_by_word = [];
			Game.players[i].current_word_cells_id = [];
			Game.players[i].current_allowed_cells = null;
		}
	},

	init: function() {

		/* Save app_node */
		Game.root_node = document.getElementById('game-screen');
		if( ! Game.root_node ) {
			console.error("Game.init() expects the id of the root node (the game container) as its first argument.");
			return false;
		}

		/* Data not to be initiated when loading a game (already loaded and processed) */
		if( ! Game.app_already_initiated ) {
			/* Generate info-pane node */
			var info_pane_node = document.createElement('div');
			info_pane_node.setAttribute('id', 'info-pane');
			Game.root_node.appendChild(info_pane_node);
		
		} else {
			var info_pane_node = document.getElementById('info-pane');
		}


		/* Load current lang letters distribution and score data, and UX lang data */
		if( obj_is_empty(Game.distribution_data) ) {
			if( ! Game.load_lang_data(Game.settings.game_lang) ) {
				return false;
			}
		}

		/* Setup/Reset game_letters_pool */
		if( obj_is_empty(Game.game_letters_pool) ) {
			for(var letter in Game.distribution_data) {
				Game.game_letters_pool[letter] = Game.distribution_data[letter].availability;
			}
		}
		

		/* Generate content for info-pane node */
		var players_list_dl_html = '';
		for(var i = 0; i < Game.players.length; i++) {
			players_list_dl_html += 
				'<dt id="info-players-name-'+i+'" class="info-player-name">'+Game.players[i].name+'</dt>'+
				'<dd id="info-players-score-'+i+'" class="info-player-score">'+Game.players[i].current_score+' points</dd>';
		}

		var info_pane_html = 
			'<div id="info-block-current-turn" class="info-block">'+
				'<div id="info-block-current-player"></div>'+
			'</div>'+
			'<div id="info-block-players" class="info-block">'+
				'<h3 id="info-block-current-turn-value"></h3>'+
				'<dl id="players-list">'+
					players_list_dl_html +
				'</dl>'+
			'</div>'+
			'<div id="info-block-player-letters" class="info-block">'+
				'<div class="info-player-letters-holder">'+
					'<div id="info-player-letters-value"></div>'+
				'</div>'+
			'</div>' +
			'<div id="info-block-actions" class="info-block">' +
				'<a href="#" id="info-action-next-turn-button" class="disabled">Tour suivant</a>' +
			'</div>'+
			'<div id="info-block-log" class="info-block">' +
				'<table id="log-list">'+
					'<thead><tr>'+
						'<th style="width: 25px;">#</th>'+
						'<th style="width: 100px;">'+Game.lang('score_table_player')+'</th>'+
						'<th>'+Game.lang('score_table_words')+'</th>'+
						'<th style="width: 40px;">'+Game.lang('score_table_score')+'</th>'+
					'</tr></thead>'+
					'<tbody>'+
					'</tbody>'+
				'</table>'+
			'</div>';
		info_pane_node.innerHTML = info_pane_html;
	



		/* Generate board node and inner board cells
			and then find special tiles positions and
			update board CSS */
		Game.generate_board_node();
		Game.generate_special_tiles();


		/* Init UX vendor libraries */
		Game.init_ux_libraries();


		/* Register / Setup UX event listeners */
		Game.register_ux_listeners();


		Game.app_already_initiated = true;

		/* Save game name if player reloads page */
		localStorage.setItem(GAME_GLOBAL_LOCALSTORAGE_PREFIX + 'last_game_name', Game.game_name);
	},

	load_lang_data: function(lang_slug) {
		if( ! game_letters_data[lang_slug] ) {
			console.error("Trying to load letters distribution data for a non existing language ('"+lang_slug+"')");
			return false;
		}

		if( ! game_lang_data[lang_slug] ) {
			console.error("Trying to load lang data for a non existing language ('"+lang_slug+"')");
			return false;
		}

		Game.distribution_data = game_letters_data[lang_slug];
		Game.lang_data = game_lang_data[lang_slug];

		return true;
	},

	generate_board_node: function() {
		
		Game.board_node = document.createElement('div');
		Game.board_node.setAttribute('id', 'board');

		var inner_board_html = '<div class="inner-wrapper">';
		
		for(var i = 0; i < GAME_NUM_CELLS_PER_SIDE; i++) {
			for(var j = 0; j < GAME_NUM_CELLS_PER_SIDE; j++) {
				var cell_index = j + i * GAME_NUM_CELLS_PER_SIDE;
				inner_board_html += '<div class="cell" data-index="'+cell_index+'" data-letter=""><div class="highlighter"></div></div>';
			}

			inner_board_html += '<div style="clear: both;"></div>';
		}

		inner_board_html += '</div>'; // Closing .inner-wrapper

		Game.board_node.innerHTML = inner_board_html;

		Game.root_node.appendChild(Game.board_node);
	},

	generate_special_tiles: function() {
		var top_half_tiles = {
			0: '3w', 3: '2l', 7: '3w', 11: '2l', 14: '3w',
			16: '2w', 20: '3l', 24: '3l', 28: '2w',
			32: '2w', 36: '2l', 38: '2l', 42: '2w',
			45: '2l', 48: '2w', 52: '2l', 56: '2w', 59: '2l',
			64: '2w', 70: '2w',
			76: '3l', 80: '3l', 84: '3l', 88: '3l',
			92: '2l', 96: '2l', 98: '2l', 102: '2l'
		};

		var middle_tiles = {
			105: '3w', 108: '2l', 112: 'start', 116: '2l', 119: '3w'
		};

		var bottom_half_tiles = {};
		
		var board_num_tiles = GAME_NUM_CELLS_PER_SIDE * GAME_NUM_CELLS_PER_SIDE;

		for(var top_index in top_half_tiles) {
			var tile_coords = Game.conv_1d_to_2d(top_index);
			var sym_coords = [
				tile_coords[0],
				GAME_NUM_CELLS_PER_SIDE - tile_coords[1]
			];
			var bottom_index = Game.conv_2d_to_1d(sym_coords) - GAME_NUM_CELLS_PER_SIDE;
			bottom_half_tiles[bottom_index] = top_half_tiles[top_index];
		}

		Game.special_tiles = obj_merge(
			top_half_tiles, 
			middle_tiles,
			bottom_half_tiles
		);

		/* Style board special tiles */
		for(var tile_index in Game.special_tiles) {
			var tile_value = Game.special_tiles[tile_index];
			var cell_node = document.querySelector('#board div[data-index="'+tile_index+'"]');
			cell_node.setAttribute('special', tile_value);

			var inner_node = document.createElement('div');
			inner_node.classList.add('special');
			inner_node.classList.add('special-' + tile_value);

			if( tile_value != "start" ) {
				inner_node.innerHTML = Game.lang("tile-special-" + tile_value);
			}
			cell_node.appendChild(inner_node);
		}
	},

	register_ux_listeners: function() {
		document.getElementById('info-action-next-turn-button').addEventListener('click', function(event) {
			event.preventDefault();
			
			if( event.target.classList.contains('disabled') ) {
				return false;
			}

			Game.end_current_turn();

		}, false);
	},

	init_ux_libraries: function() {

		var dragged_letter_index_in_player_pool;
		var droppable_target = null;
		var draggable_start_pos = {x: 0, y: 0};

		/* Dragging letters from player pool */
		interact('#info-block-player-letters:not(.disabled) .letter-tile')
		.draggable({
			inertia: false,
			autoScroll: true,

			onstart: function(event) {
				droppable_target = null;
				Game.last_hovered_cell_node = null;

				dragged_letter_index_in_player_pool = [].indexOf.call(event.target.parentNode.children, event.target);
			},

			onmove: function(event) {
				var target = event.target,
			        x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
			        y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

			    target.style.webkitTransform =
			    target.style.transform =
			      'translate(' + x + 'px, ' + y + 'px)';

			    target.setAttribute('data-x', x);
			    target.setAttribute('data-y', y);
			    target.setAttribute('data-dragging', 1);
			},

			onend: function (event) {
				var draggableTarget = event.target;
				draggableTarget.setAttribute('data-dragging', 0);

				// If user dropped letter on valid node (A free and allowed cell from the board)
				if( droppable_target ) {

					droppable_target.classList.remove('droppable-over');

					if( ! draggableTarget.classList.contains('invalid-move') ) {
						var selected_letter = draggableTarget.getAttribute('data-letter');
						var selected_cell_id = parseInt(droppable_target.getAttribute('data-index'));

						// Append letter node to cell 
						droppable_target.appendChild(draggableTarget);
						droppable_target.classList.remove('droppable-over');
						droppable_target.setAttribute('data-letter', selected_letter);

						draggableTarget.classList.add('current-turn-letter-tile');

						// Remove previous highlights
						Game.deemphasize_highlighted_cells();
						
						// Find currently played word, handling letters placed before and/or after first placed letter
						Game.current_playing_player.current_word_cells_id.push(selected_cell_id);
						

						// Add Player's letters to current_cells_value 
						Game.current_cells_value[selected_cell_id] = selected_letter;

						// Update player's letters pool (removes the dropped letter)
						Game.current_playing_player.letters_pool.splice(dragged_letter_index_in_player_pool, 1);

						// When a second letter has been placed, find the direction (horizontal or vertical)
						// of the currently played word.
						Game.find_current_word_direction();

						// Find allowed cells after player's move
						Game.find_allowed_cells();

						// Highlight valid cells for letter placement
						Game.highlight_cells(Game.current_playing_player.current_allowed_cells);
					}

					droppable_target.classList.remove('invalid-move');
				}

				draggableTarget.classList.remove('invalid-move');

				draggableTarget.setAttribute('data-x', 0);
		    	draggableTarget.setAttribute('data-y', 0);

		    	draggableTarget.style.webkitTransform =
			    draggableTarget.style.transform =
			    	'translate(0px, 0px)';
		    }
		});

		/* Dropping letter on board */
		interact('#board .cell')
		.dropzone({
			overlap: 'pointer',

			ondragenter: function (event) {
				var draggableElement = event.relatedTarget,
				    dropzoneElement = event.target;

				dropzoneElement.classList.add('droppable-over');
				Game.last_hovered_cell_node = dropzoneElement;

				draggableElement.classList.remove('invalid-move');

				var hovered_cell_id = parseInt(dropzoneElement.getAttribute('data-index'));

				// Check cell is empty
				if( Game.current_cells_value[hovered_cell_id] ) {
					draggableElement.classList.add('invalid-move');
					dropzoneElement.classList.add('invalid-move');
				}

				// Check move is on an allowed cell of currently played word  
				else if( Game.current_playing_player.current_allowed_cells && Game.current_playing_player.current_allowed_cells.length ) {
					if( Game.current_playing_player.current_allowed_cells.indexOf(hovered_cell_id) === -1 ) {
						draggableElement.classList.add('invalid-move');
						dropzoneElement.classList.add('invalid-move');
					} 
				}
			},

			ondragleave: function (event) {
				var draggableElement = event.relatedTarget,
				    dropzoneElement = event.target;

				dropzoneElement.classList.remove('droppable-over');
				Game.last_hovered_cell_node.classList.remove('invalid-move');
			},

			ondrop: function (event) {
				var draggableElement = event.relatedTarget,
				    dropzoneElement = event.target;

				droppable_target = dropzoneElement;
				/* The actual tile placement takes place in draggable.onend callback */
			}
		})
	},


	/*******************
	* HELPER METHODS *
	********************/
	lang: function(lang_data_id) {
		var return_value;

		if( Game.lang_data[lang_data_id] ) {
			return_value = Game.lang_data[lang_data_id];
		} else {
			return_value = lang_data_id;
		}

		return return_value;
	},

	conv_1d_to_2d: function(n) {
		return [
			n % GAME_NUM_CELLS_PER_SIDE,
			Math.floor( n / GAME_NUM_CELLS_PER_SIDE )
		];
	},

	// Accepted arguments:
	// - An array of x and y coordinates or,
	// - directly x and y as different arguments
	conv_2d_to_1d: function(xy, opt_y) {
		var x, y;
		
		if( xy instanceof Array ) {
			x = xy[0];
			y = xy[1];
		} else {
			x = xy;
			y = opt_y;
		}

		return x + y * GAME_NUM_CELLS_PER_SIDE;
	},

	find_adjacent_cells: function(cell_id) {
		var coords2d = Game.conv_1d_to_2d(cell_id);
		var adjacent_ids = [];

		if(coords2d[0] > 0) { // left
			adjacent_ids.push( Game.conv_2d_to_1d(coords2d[0] - 1, coords2d[1]) ); 
		}

		if(coords2d[0] < GAME_NUM_CELLS_PER_SIDE - 1) { // right
			adjacent_ids.push( Game.conv_2d_to_1d(coords2d[0] + 1, coords2d[1]) );
		}

		if(coords2d[1] > 0) { // top
			adjacent_ids.push( Game.conv_2d_to_1d(coords2d[0], coords2d[1] - 1) );
		}

		if(coords2d[1] < GAME_NUM_CELLS_PER_SIDE - 1) { // bottom
			adjacent_ids.push( Game.conv_2d_to_1d(coords2d[0], coords2d[1] + 1) );
		}

		return adjacent_ids;
	},


	/*******************
	* UX METHODS *
	********************/

	// Accepted arguments:
	// - An array of cell_id 1d coordinates
	// - directly one coordinate
	highlight_cells: function(cells) {
		if( ! cells instanceof Array ) {
			cells = [cells];
		}

		for(var i = 0; i < cells.length; i++) {
			var cell_node = document.querySelector('#board div[data-index="'+cells[i]+'"]');
			cell_node.classList.add('highlight');
		}
	},

	deemphasize_highlighted_cells: function() {
		var previously_highlighted_nodes = document.querySelectorAll('#board div.highlight');
		for(var i = 0; i < previously_highlighted_nodes.length; i++) {
			previously_highlighted_nodes[i].classList.remove('highlight');
		}
	},

	add_log_row_from_turn_data: function(turn_history_data) {
		var played_words_html_title = turn_history_data.words.replace(/\+/g, ' + ');
		var player_name = Game.players[turn_history_data.player_id].name;

		// Update info pane log table
		var log_values = [
			'<div class="log-turn">' + (turn_history_data.turn + 1) + '</div>', 
			'<div class="log-player" title="'+player_name+'">' + player_name + '</div>', 
			'<div class="log-words" title="'+played_words_html_title+'">' + turn_history_data.words_log_html + '</div>', 
			'<div class="log-score">' + turn_history_data.score + '</div>'
		];
		var log_table = document.getElementById('log-list').getElementsByTagName('tbody')[0];

		var new_row = log_table.insertRow(0);
		for(var i = 0; i < log_values.length; i++) {
			var new_cell  = new_row.insertCell(i);
			new_cell.innerHTML = log_values[i];
		}
	},

	update_info_pane_values: function() {
		// Players score indicator
		for(var i = 0; i < Game.players.length; i++) {
			var player = Game.players[i];
			var score_val = player.current_score;
			document.getElementById('info-players-score-' + player.id).innerHTML = score_val + " points";
		}

		// Current turn info
		document.getElementById('info-block-current-turn-value').innerHTML = "Tour n°" + (Game.current_turn + 1) + 
			'<span class="remaining-letters">'+
				Game.get_remaining_letters_in_pool()+" lettres restantes"+
			'</span>';

		// Current player info
		document.getElementById('info-block-current-player').innerHTML = Game.current_playing_player.name + '<small>'+Game.game_name+'</small>';

		// Current player highlight
		var currentPlayerDLEl = document.querySelector('#players-list .info-player-name.current');
		if( currentPlayerDLEl ) {
			currentPlayerDLEl.classList.remove('current');
		}
		document.getElementById('info-players-name-' + Game.current_playing_player.id).classList.add('current')
	},

	/*******************
	* GAMEPLAY METHODS *
	********************/

	push_turn_data_to_history: function(turn_data) {
		// turn_data format expected: {turn, player_id, words (separated by "+"), score, words_log_html}
		Game.history_repository.push(turn_data);
	},

	get_game_full_state: function() {

		return {
			game_name: Game.game_name,

			settings: Game.settings,
			distribution_data: Game.distribution_data,
			lang_data: Game.lang_data,
			
			current_cells_value: Game.current_cells_value,
			game_letters_pool: Game.game_letters_pool,

			players: Game.players,

			current_playing_player_id: Game.current_playing_player.id,
			current_turn: Game.current_turn,

			history_repository: Game.history_repository
		};
	},

	set_game_full_state: function(state_data_input) {
		Game.init_player_data(state_data_input.players, true);

		Game.game_name = state_data_input.game_name;
		
		Game.settings = state_data_input.settings;
		Game.distribution_data = state_data_input.distribution_data;
		Game.lang_data = state_data_input.lang_data;

		Game.current_cells_value = state_data_input.current_cells_value;
		Game.game_letters_pool = state_data_input.game_letters_pool;

		Game.current_turn = state_data_input.current_turn;
		Game.history_repository = state_data_input.history_repository;

		Game.init();

		/* Init loaded players letters pool */
		for(var i = 0; i < Game.players.length; i++) {
			Game.pick_letters_for_player(Game.players[i].id);

			if( Game.players[i].active ) {
				Game.render_player_letters_pool(Game.players[i].id);
			}
		}

		Game.set_playing_player(state_data_input.current_playing_player_id);

		/* Load/Render tiles on board */
		for(var cell_id in Game.current_cells_value) {
			var letter_value = Game.current_cells_value[cell_id];
			var cell_element = document.querySelector('.cell[data-index="'+cell_id+'"]');
			var tile_element = Game.generate_letter_tile_html(letter_value, true);

			cell_element.appendChild(tile_element);
			cell_element.setAttribute('data-letter', letter_value);
		}

		/* Load/Render log info data */
		for(var i in Game.history_repository) {
			turn_history_data = Game.history_repository[i];
			Game.add_log_row_from_turn_data(turn_history_data)
		}
	},

	start_new_game: function(players_data, game_name) {
		Game.game_name = game_name;

		Game.init_player_data(players_data);
		Game.init();

		/* Init starting players letters pool */
		for(var i = 0; i < Game.players.length; i++) {
			Game.pick_letters_for_player(Game.players[i].id);

			if( Game.players[i].active ) {
				Game.render_player_letters_pool(Game.players[i].id);
			}
		}

		/* Select starting player randomly */
		var starting_player_id = Game.get_random_player_id();
		Game.set_playing_player(starting_player_id);
	},

	save_game_save: function() {
		var game_save_data = Game.get_game_full_state();

		localStorage.setItem(GAME_SAVES_LOCALSTORAGE_PREFIX + Game.game_name, JSON.stringify(game_save_data));
	},

	load_game_save: function(game_name) {
		var raw_saved_data = localStorage.getItem(GAME_SAVES_LOCALSTORAGE_PREFIX + game_name);

		if( ! raw_saved_data ) {
			console.error('Can\'t find any saved game called ' + game_name);
			return;
		}

		Game.set_game_full_state(JSON.parse(raw_saved_data));
	},

	delete_game_save: function(game_name) {
		localStorage.removeItem(GAME_SAVES_LOCALSTORAGE_PREFIX + game_name);
	},

	get_random_player_id: function() {
		return Math.floor(Math.random() * Game.players.length);
	},

	get_remaining_letters_in_pool: function() {
		var count = 0;
		for(var letter in Game.game_letters_pool) {
			count += Game.game_letters_pool[letter];
		}
		return count;
	},

	log_close_words(words) {
		Game.check_words_validity(words, function(response) {
			if( response.additionnal_data && ! obj_is_empty(response.additionnal_data) ) {
				console.log('----------------------------------'); 
				for(var orig_word in response.additionnal_data) {
					var suggestions = response.additionnal_data[orig_word];
					if( suggestions == "*" ) {
						console.log(orig_word + " => " + "*");
					} else {
						console.log(orig_word + " => " + suggestions.join(', '));
					}
				}
				console.log('----------------------------------'); 
			}
			
		});
	},

	check_words_validity: function(words, after_check_cb) {
		// @TODO : Handle "joker" tiles in the spell-checker script
		Request.post(GAME_SPELL_CHECKER_URL, {
			word: words, 
			lang: Game.lang_data['__aspell_lang_code'], 
			locale: Game.lang_data['__server_locale'],
		}, function(xhr) {
			// Request success
			var jsonResponse = JSON.parse(xhr.responseText);
			
			if( jsonResponse.status && jsonResponse.status == "ok" ) {
				after_check_cb(jsonResponse);
			} else {
				console.error('An error occured on the server');
				console.error('[DEBUG] SERVER MESSAGE :');
				console.error(jsonResponse.message);
			}

		}, function(xhr) {

			// Request error
			console.error('An error occured while contacting the spell_checker script :/');
			console.error('[DEBUG] XHR OBJECT :');
			console.error(xhr);
		})
	},

	end_current_turn: function() {
		var word_bounds = Game.find_current_word_boundaries();
		Game.current_playing_player.current_played_words = "";
		Game.current_playing_player.current_played_cells_by_word = [];

		var num_placed_letters = Game.current_playing_player.current_word_cells_id.length;
		
		if( num_placed_letters ) {

			if( ! Game.current_playing_player.current_word_direction ) {
				var cell_id = Game.current_playing_player.current_word_cells_id[0];
				var cell_coords = Game.conv_1d_to_2d(cell_id);

				var left_id  = cell_coords[0] > 0 ? Game.conv_2d_to_1d(cell_coords[0] - 1, cell_coords[1]) : null;
				var right_id = cell_coords[0] < GAME_NUM_CELLS_PER_SIDE - 1 ? Game.conv_2d_to_1d(cell_coords[0] + 1, cell_coords[1]) : null;

				if( left_id && Game.current_cells_value[left_id] ||
					right_id && Game.current_cells_value[right_id] ) {

					Game.current_playing_player.current_word_direction = "horizontal";
				} else {
					Game.current_playing_player.current_word_direction = "vertical";
				}
			}

			if( Game.current_playing_player.current_word_direction == "vertical" ) {
				var primary_word_bounds = word_bounds.vertical;

				var primary_walker_adder = GAME_NUM_CELLS_PER_SIDE;
				var secondary_walker_adder = 1;
			} else if( Game.current_playing_player.current_word_direction == "horizontal" ) {
				var primary_word_bounds = word_bounds.horizontal;

				var primary_walker_adder = 1;
				var secondary_walker_adder = GAME_NUM_CELLS_PER_SIDE;
			}
			
			var primary_walker_cell_index = primary_word_bounds[0] !== null ? primary_word_bounds[0] + primary_walker_adder : 0;
			var words_found = [];
			words_found[0] = "";

			var cells_found = [];
			cells_found[0] = [];   // Format of each item : { cell_id: <id>, free_cell: true|false, letter: <tile letter as string> (for debug purposes) }

			var get_prev_next_adj_ids = function(cell_id) {
				var cell_coords = Game.conv_1d_to_2d(cell_id);

				if( Game.current_playing_player.current_word_direction == "vertical" ) {

					var prev_adjacent_id = cell_coords[0] > 0 ? Game.conv_2d_to_1d(cell_coords[0] - 1, cell_coords[1]) : null;
					var next_adjacent_id = cell_coords[0] < GAME_NUM_CELLS_PER_SIDE - 1 ? Game.conv_2d_to_1d(cell_coords[0] + 1, cell_coords[1]) : null;

				} else if( Game.current_playing_player.current_word_direction == "horizontal" ) {
					
					var prev_adjacent_id = cell_coords[1] > 0 ? Game.conv_2d_to_1d(cell_coords[0], cell_coords[1] - 1) : null;
					var next_adjacent_id = cell_coords[1] < GAME_NUM_CELLS_PER_SIDE - 1 ? Game.conv_2d_to_1d(cell_coords[0], cell_coords[1] + 1) : null;
				}

				return [prev_adjacent_id, next_adjacent_id];
			}

			while(primary_walker_cell_index < primary_word_bounds[1]) {
				words_found[0] += Game.current_cells_value[primary_walker_cell_index];
				
				if( Game.current_playing_player.current_word_cells_id.indexOf(primary_walker_cell_index) != -1 ) { // If letter played by player

					cells_found[0].push({cell_id: primary_walker_cell_index, free_cell: true, letter: Game.current_cells_value[primary_walker_cell_index]});

					var adj_ids = get_prev_next_adj_ids(primary_walker_cell_index);
					
					if( adj_ids[0] && Game.current_cells_value[adj_ids[0]] ||
						adj_ids[1] && Game.current_cells_value[adj_ids[1]] ) {

						var new_word = "";
						var new_word_cells = [];

						var secondary_walker_cell_index = adj_ids[0];

						// Find first id of subword
						while(true) {
							var adj_ids = get_prev_next_adj_ids(secondary_walker_cell_index);

							if( adj_ids[0] === null || ( ! Game.current_cells_value[adj_ids[0]] ) ) {
								break;
							} else {
								secondary_walker_cell_index = adj_ids[0];
							}
						}

						// Add word to list
						while(true) {
							if( Game.current_cells_value[secondary_walker_cell_index] ) {
								new_word += Game.current_cells_value[secondary_walker_cell_index];

								if( Game.current_playing_player.current_word_cells_id.indexOf(secondary_walker_cell_index) != -1 ) { // If letter played by player
									new_word_cells.push({cell_id: secondary_walker_cell_index, free_cell: true, letter: Game.current_cells_value[secondary_walker_cell_index]});
								} else {
									new_word_cells.push({cell_id: secondary_walker_cell_index, free_cell: false, letter: Game.current_cells_value[secondary_walker_cell_index]});
								}
							}

							var adj_ids = get_prev_next_adj_ids(secondary_walker_cell_index);

							if( adj_ids[1] === null || ( ! Game.current_cells_value[adj_ids[1]] ) ) {
								break;
							} else {
								secondary_walker_cell_index = adj_ids[1];
							}
						}

						words_found.push(new_word);
						cells_found.push(new_word_cells);
					}
				} else {
					cells_found[0].push({cell_id: primary_walker_cell_index, free_cell: false, letter: Game.current_cells_value[primary_walker_cell_index]});
				}

				primary_walker_cell_index += primary_walker_adder;
			}
			
			Game.current_playing_player.current_played_words = words_found.join('+');
			Game.current_playing_player.current_played_cells_by_word = cells_found;
		
		} else {
			// If no letter were placed, player is passing his turn
			var turn_history_data = {
				turn: Game.current_turn, 
				player_id: Game.current_playing_player.id, 
				words: "", 
				words_log_html: "<span></span>",
				score: 0
			};
			Game.push_turn_data_to_history(turn_history_data);
			Game.add_log_row_from_turn_data(turn_history_data);

			// Increment turn variable
			Game.current_turn += 1;

			// Set turn to next player
			Game.set_playing_player(Game.current_playing_player.next_player_id);

			// Save game
			Game.save_game_save();

			// Skip Word Spellchecking
			return;
		}

		Game.check_words_validity(Game.current_playing_player.current_played_words.replace('+', ' '), function(jsonResponse) {
			
			var words_validity = jsonResponse.message;
			var invalid_words = [];

			for(var v_word in words_validity) {
				if( words_validity[v_word] == "invalid" ) {
					invalid_words.push(v_word);
				}
			}

			if( invalid_words.length == 0 ) {
				// Valid turn !

				var words_log_html = "";
			
				// Calculate score
				var turn_words = Game.current_playing_player.current_played_words.split('+');
				var turn_cells = Game.current_playing_player.current_played_cells_by_word;

				var turn_score = 0;

				for(var i = 0; i < turn_words.length; i++) {

					var curr_word = turn_words[i];
					var curr_cells = turn_cells[i];

					var this_word_multiplier = 1;
					var this_word_score = 0;
					var this_word_letters_log_html = "";

					for(var letter_index in curr_word) {

						var cell_letter = curr_word[letter_index]; 
						var cell_turn_data = curr_cells[letter_index];

						var base_letter_score = Game.distribution_data[cell_letter].score_value;
						var special_tile_data = Game.special_tiles[cell_turn_data.cell_id];

						var this_letter_log_opening_span = '<span class="letter">';

						if( cell_turn_data.free_cell && special_tile_data ) {
							if( special_tile_data == "start" ) { // Star (starting) tile doubles the word points
								var modifier_type = "start";
								var modifier_multiplicator = 2;
							} else {
								var modifier_string = special_tile_data.split('');
								var modifier_type = modifier_string[1].toLowerCase();
								var modifier_multiplicator = parseInt(modifier_string[0]);
							}

							if( modifier_type == "l" ) { // Letter modifier
								base_letter_score *= modifier_multiplicator;
								this_letter_log_opening_span = '<span class="modifier letter" data-modifier-type="l" data-modifier-multiplicator="'+modifier_multiplicator+'">';
							} else if( modifier_type == "w" || modifier_type == "start" ) {
								this_word_multiplier *= modifier_multiplicator;
							}
						}

						this_word_letters_log_html += this_letter_log_opening_span + cell_letter.replace('*', '_') + '</span>';
						this_word_score += base_letter_score;
					}

					var this_word_log_opening_span = '<span class="word">';

					if( this_word_multiplier > 1 ) {
						this_word_score *= this_word_multiplier;
						this_word_log_opening_span = '<span class="modifier word" data-modifier-type="w" data-modifier-multiplicator="'+this_word_multiplier+'">';
					}

					words_log_html += this_word_log_opening_span + this_word_letters_log_html + '</span>';
					turn_score += this_word_score
				}

				// @TODO: Implement "SCRABBLE !" when all current player's letters are added in one turn (+50points after processing modifiers)

				Game.current_playing_player.current_score += turn_score;

				var turn_history_data = {
					turn: Game.current_turn, 
					player_id: Game.current_playing_player.id, 
					words: Game.current_playing_player.current_played_words, 
					words_log_html: words_log_html,
					score: turn_score
				};
				Game.push_turn_data_to_history(turn_history_data);
				Game.add_log_row_from_turn_data(turn_history_data);

				var current_turn_tiles = document.querySelectorAll('.current-turn-letter-tile');
				for(var i = 0; i < current_turn_tiles.length; i++) {
					current_turn_tiles[i].classList.remove('current-turn-letter-tile')
				}
				
				// Increment turn variable
				Game.current_turn += 1;

				// Set turn to next player
				Game.set_playing_player(Game.current_playing_player.next_player_id);

				// Save game
				Game.save_game_save();
			

			} else {
				// Oops there's an invalid word !

				// @TODO: Cancel player moves
				Game.show_notice_popup('invalid', 'The following words were not found in the dictionnary : ' + invalid_words.join(','));
			}
		});

	},

	find_current_word_direction: function() {
		if( Game.current_playing_player.current_word_cells_id.length == 2 ) {
			var prev_coords = Game.conv_1d_to_2d(Game.current_playing_player.current_word_cells_id[0]);
			var curr_coords = Game.conv_1d_to_2d(Game.current_playing_player.current_word_cells_id[1]);

			if( prev_coords[0] == curr_coords[0] ) {
				Game.current_playing_player.current_word_direction = "vertical";
			} else if( prev_coords[1] == curr_coords[1] ) {
				Game.current_playing_player.current_word_direction = "horizontal";
			} else {
				console.error('Wat? Where the fuck did you place that letter ??');
			}
		}
	},

	find_current_word_boundaries: function() {
		var minX = 9999, minY = 9999, maxX = -1, maxY = -1;

		for(var i = 0; i < Game.current_playing_player.current_word_cells_id.length; i++) {
			var this_cell_id = Game.current_playing_player.current_word_cells_id[i];
			var coords2d = Game.conv_1d_to_2d(this_cell_id);

			if( coords2d[0] < minX ) { minX = coords2d[0]; }
			if( coords2d[0] > maxX ) { maxX = coords2d[0]; }
			if( coords2d[1] < minY ) { minY = coords2d[1]; }
			if( coords2d[1] > maxY ) { maxY = coords2d[1]; }
		}

		var left1d = minX > 0 ? Game.conv_2d_to_1d(minX - 1, minY) : null;
		var right1d = maxX < GAME_NUM_CELLS_PER_SIDE - 1 ? Game.conv_2d_to_1d(maxX + 1, maxY) : null;
		var bottom1d = minY > 0 ? Game.conv_2d_to_1d(minX, minY - 1) : null;
		var top1d = maxY < GAME_NUM_CELLS_PER_SIDE - 1 ? Game.conv_2d_to_1d(maxX, maxY + 1) : null;

		var result_array = [];

		for(var coords_axis_index = 0; coords_axis_index < 2; coords_axis_index++) {
			if( coords_axis_index == 0 ) {
				var first_id = left1d;
				var last_id = right1d;
			} else {
				var first_id = bottom1d;
				var last_id = top1d;
			}

			if( first_id ) {
				while( Game.current_cells_value[first_id] ) {
					var cell_coords = Game.conv_1d_to_2d(first_id);
					cell_coords[coords_axis_index] -= 1;

					if( cell_coords[coords_axis_index] < 0 ) {
						first_id = null;
						break;
					}

					first_id = Game.conv_2d_to_1d(cell_coords);
				}
			}

			if( last_id ) {
				while( Game.current_cells_value[last_id] ) {
					var cell_coords = Game.conv_1d_to_2d(last_id);
					cell_coords[coords_axis_index] += 1;

					if( cell_coords[coords_axis_index] > GAME_NUM_CELLS_PER_SIDE - 1 ) {
						last_id = null;
						break;
					}

					last_id = Game.conv_2d_to_1d(cell_coords);
				}
			}

			result_array[coords_axis_index] = [first_id, last_id];
		}
		
		return {
			horizontal: result_array[0],
			vertical: result_array[1]
		};
	},

	find_allowed_cells: function() {

		var allowed_cells = [];

		if( ! Game.current_playing_player.current_word_cells_id.length ) {

			// Player didn't add any letter yet
			for(var cell_id in Game.current_cells_value) {
				var adjacent_ids = Game.find_adjacent_cells(cell_id);

				for(var i = 0; i < adjacent_ids.length; i++) {
					var adj_cell_id = adjacent_ids[i];
					if( adj_cell_id && (! Game.current_cells_value[adj_cell_id]) && allowed_cells.indexOf(adj_cell_id) == -1 ) {
						allowed_cells.push(adj_cell_id);
					}
				}
			}

		} else {

			// Player's added at least a letter 
			var bounds = Game.find_current_word_boundaries();

			if( Game.current_playing_player.current_word_direction == null ) {
				allowed_cells = bounds.horizontal.concat(bounds.vertical);
			} else {
				allowed_cells = bounds[Game.current_playing_player.current_word_direction];
			}
		}

		allowed_cells = allowed_cells.filter( function(cell_id) { return cell_id !== null; });

		Game.current_playing_player.current_allowed_cells = allowed_cells;
	},

	set_playing_player: function(player_id) {
		// Reset turn variables of player ending his turn
		if( Game.current_playing_player ) {
			Game.current_playing_player.current_word_direction = null;
			Game.current_playing_player.current_allowed_cells = null;
			Game.current_playing_player.current_played_words = "";
			Game.current_playing_player.current_played_cells_by_word = [];
			Game.current_playing_player.current_word_cells_id = [];

			Game.deemphasize_highlighted_cells();
		}

		// Set current player
		Game.current_playing_player = Game.players[player_id];
		var current_player_is_active_player = !! Game.current_playing_player.active;

		if( current_player_is_active_player ) {
			document.getElementById('info-block-player-letters').classList.remove('disabled');
		} else {
			document.getElementById('info-block-player-letters').classList.add('disabled');
		}


		/* Pick letters for player */
		Game.pick_letters_for_player(player_id);


		// Update info pane indicators
		Game.update_info_pane_values();

		/* Update letters indicator if playing player is active */
		if(Game.current_playing_player.active) {
			Game.render_player_letters_pool(Game.current_playing_player.id);
			document.getElementById('info-action-next-turn-button').classList.remove('disabled');
		} else {
			document.getElementById('info-action-next-turn-button').classList.add('disabled');
		}

		/* Show allowed cells */
		if( Object.keys(Game.current_cells_value).length ) {
			Game.find_allowed_cells();
			Game.highlight_cells(Game.current_playing_player.current_allowed_cells);
		}
	},

	generate_letter_tile_html: function(letter, asDOMElement) {
		var letter_score = Game.distribution_data[letter].score_value;

		var letter_html = letter;
		var letter_score_html = letter_score;
		var blank_class = '';

		if( letter == '*' ) {
			letter_html = '*';
			letter_score_html = '*';
			blank_class = 'is-blank';
		}

		var html_code = '<span class="letter-tile '+blank_class+'" '+
			'data-letter="'+letter+'" '+
			'data-score="'+letter_score+'">'+
				letter_html+
				'<sub>'+letter_score_html+'</sub>'+
			'</span>';

		if( asDOMElement ) {
			var div = document.createElement('div');
			div.innerHTML = html_code;
			return div.firstChild;
		} 
		
		return html_code;
	
	},

	pick_letters_for_player: function(player_id) {
		var player = Game.players[player_id];
		var num_letters_to_draw = GAME_NUM_LETTERS_PER_PLAYER - player.letters_pool.length;

		var available_letters = [];
		for(var letter_val in Game.game_letters_pool) {
			for(var i = 0; i < Game.game_letters_pool[letter_val]; i++) {
				available_letters.push(letter_val);
			}
		}

		for(var i = 0; i < num_letters_to_draw; i++) {
			var selected_letter = available_letters[ Math.floor(Math.random() * available_letters.length) ];

			Game.game_letters_pool[selected_letter] -= 1;
			if( Game.game_letters_pool[selected_letter] <= 0 ) {
				delete Game.game_letters_pool[selected_letter];
			}

			player.letters_pool.push(selected_letter);
		}
	},

	render_player_letters_pool: function(player_id) {
		var player = Game.players[player_id];

		var letters_pool_html = '';
		for(var i = 0; i < player.letters_pool.length; i++) {
			letters_pool_html += Game.generate_letter_tile_html(player.letters_pool[i]);
		}

		document.getElementById('info-player-letters-value').innerHTML = letters_pool_html;
	}
}