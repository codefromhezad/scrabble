var GAME_NUM_CELLS_PER_SIDE = 15;
var GAME_NUM_LETTERS_PER_PLAYER = 7;

var Game = {
	settings: {
		game_lang: "french"
	},

	distribution_data: {},
	current_cells_value: [],
	game_letters_pool: {},

	root_node: null,
	board_node: null,

	players: [],
	current_playing_player: null,

	last_hovered_cell_node: null,



	/***************
	* INIT METHODS *
	****************/

	init: function(app_node_id, players_data) {

		/* Save app_node */
		Game.root_node = document.getElementById(app_node_id);
		if( ! Game.root_node ) {
			console.error("Game.init() expects the id of the root node (the game container) as its first argument.");
			return false;
		}


		/* Load current lang letters distribution and score data */
		if( ! Game.load_lang_distribution_data(Game.settings.game_lang) ) {
			return false;
		}


		/* Setup/Reset game_letters_pool */
		for(var letter in Game.distribution_data) {
			Game.game_letters_pool[letter] = Game.distribution_data[letter].availability;
		}


		/* Setup players data */
		if( ! players_data || ! (players_data instanceof Array) || players_data.length < 2 ) {
			console.error("Game.init() expects an array of objects defining players as its second argument. The array must have at least 2 elements.");
			return false;
		}

		Game.players = players_data;
		var players_list_dl_html = '';

		for(var i = 0; i < Game.players.length; i++) {
			Game.players[i].id = i;
			Game.players[i].current_score = 0;
			Game.players[i].current_word_direction = null;
			Game.players[i].current_played_word = "";
			Game.players[i].current_word_cells_id = [];
			Game.players[i].current_cell_id_to_letter = {};
			Game.players[i].current_allowed_cells = null;
			Game.players[i].letters_pool = [];
			Game.players[i].next_player_id = ( (i + 1) < Game.players.length ? (i + 1) : 0 );

			players_list_dl_html += 
				'<dt id="info-players-name-'+i+'" class="info-player-name">'+Game.players[i].name+'</dt>'+
				'<dd id="info-players-score-'+i+'" class="info-player-score">'+Game.players[i].current_score+' points</dd>';
		}


		/* Generate board node and inner board cells */
		Game.generate_board_node();


		/* Generate info-pane node */
		var info_pane_node = document.createElement('div');
		info_pane_node.setAttribute('id', 'info-pane');

		var info_pane_html = 
			'<div id="info-block-current-turn" class="info-block">'+
				'<h3>Joueurs</h3>'+
				'<dl id="players-list">'+
					players_list_dl_html +
				'</dl>'+
			'</div>'+
			'<div id="info-block-player-letters" class="info-block">'+
				'<h3>Vos lettres</h3>'+
				'<div class="info-player-letters-holder">'+
					'<div id="info-player-letters-value"></div>'+
				'</div>'+
			'</div>' +
			'<div id="info-block-actions" class="info-block">' +
				'<a href="#" id="info-action-next-turn-button" class="disabled">Tour suivant</a>' +
			'</div>';
		info_pane_node.innerHTML = info_pane_html;
		Game.root_node.appendChild(info_pane_node);


		/* Init starting players letters pool */
		for(var i = 0; i < Game.players.length; i++) {
			Game.pick_letters_for_player(Game.players[i].id);

			if( Game.players[i].active ) {
				Game.render_player_letters_pool(Game.players[i].id);
			}
		}


		/* Init UX vendor libraries */
		Game.init_ux_libraries();


		/* Register / Setup UX event listeners */
		Game.register_ux_listeners();


		/* Select starting player randomly */
		var starting_player_id = Game.get_random_player_id();
		Game.set_playing_player(starting_player_id);
	},

	load_lang_distribution_data: function(lang_slug) {
		if( ! game_letters_data[lang_slug] ) {
			console.error("Trying to load letters distribution data for a non existing language ('"+lang_slug+"')");
			return false;
		}

		Game.distribution_data = game_letters_data[lang_slug];

		return true;
	},

	generate_board_node: function() {
		
		Game.board_node = document.createElement('div');
		Game.board_node.setAttribute('id', 'board');

		var inner_board_html = '<div class="inner-wrapper">';
		
		for(var i = 0; i < GAME_NUM_CELLS_PER_SIDE; i++) {
			for(var j = 0; j < GAME_NUM_CELLS_PER_SIDE; j++) {
				var cell_index = j + i * GAME_NUM_CELLS_PER_SIDE;
				inner_board_html += '<div class="cell" data-index="'+cell_index+'" data-letter=""></div>';
			}

			inner_board_html += '<div style="clear: both;"></div>';
		}

		inner_board_html += '</div>'; // Closing .inner-wrapper

		Game.board_node.innerHTML = inner_board_html;

		Game.root_node.appendChild(Game.board_node);
	},

	register_ux_listeners: function() {
		document.getElementById('info-action-next-turn-button').addEventListener('click', function(event) {
			event.preventDefault();
			
			if( event.target.classList.contains('disabled') ) {
				return false;
			}

			// @TODO
			// Check player entry validity, calculate player score
			Game.set_playing_player(Game.current_playing_player.next_player_id);

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

						// Remove previous highlights
						Game.deemphasize_highlighted_cells();
						
						// Find and setup currently played word
						Game.current_playing_player.current_word_cells_id.push(selected_cell_id);
						Game.current_playing_player.current_cell_id_to_letter[selected_cell_id] = selected_letter;
						Game.current_playing_player.current_played_word = "";

						var sorted_cells = Object.keys(Game.current_playing_player.current_cell_id_to_letter).sort();
						for(var i = 0; i < sorted_cells.length; i++) {
							var letter_cell_index = parseInt(sorted_cells[i]);
							Game.current_playing_player.current_played_word += Game.current_playing_player.current_cell_id_to_letter[letter_cell_index];
						}

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

				// Check move is valid
				if( Game.current_playing_player.current_allowed_cells && Game.current_playing_player.current_allowed_cells.length ) {
					var hovered_cell_id = parseInt(dropzoneElement.getAttribute('data-index'));
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


	/*******************
	* GAMEPLAY METHODS *
	********************/

	get_random_player_id: function() {
		return Math.floor(Math.random() * Game.players.length);
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

	find_allowed_cells: function() {

		if( ! Game.current_playing_player.current_word_cells_id.length ) {
			Game.current_playing_player.current_allowed_cells = null;
			return;
		}

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

		var allowed_cells;

		if( Game.current_playing_player.current_word_direction == null ) {
			allowed_cells = [ left1d, right1d, bottom1d, top1d ];
		} else if( Game.current_playing_player.current_word_direction == "horizontal") {
			allowed_cells = [ left1d, right1d ];
		} else if( Game.current_playing_player.current_word_direction == "vertical" ) {
			allowed_cells = [ bottom1d, top1d ];
		} else {
			console.error('Wat? current_playing_player.current_word_direction is neither null, "horizontal" nor "vertical". That makes no sense. Contact the developer to insult him.');
			return;
		}

		allowed_cells = allowed_cells.filter( function(cell_id) { return cell_id !== null; });

		Game.current_playing_player.current_allowed_cells = allowed_cells;
	},

	set_playing_player: function(player_id) {
		// Reset turn variables of player ending his turn
		if( Game.current_playing_player ) {
			Game.current_playing_player.current_word_direction = null;
			Game.current_playing_player.current_allowed_cells = null;
			Game.current_playing_player.current_played_word = "";
			Game.current_playing_player.current_word_cells_id = [];
			Game.current_playing_player.current_cell_id_to_letter = {};

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

		/* Update Players list Ux (show currently playing player) */
		var player_name_nodes = document.querySelectorAll('.info-player-name');
		for(var n = 0; n < player_name_nodes.length; n++) {
			player_name_nodes[n].classList.remove('current');
		}
		document.getElementById('info-players-name-'+Game.current_playing_player.id).classList.add('current');


		/* Pick letters for player */
		Game.pick_letters_for_player(player_id);


		/* Update letters indicator if playing player is active */
		if(Game.current_playing_player.active) {
			Game.render_player_letters_pool(Game.current_playing_player.id);
			document.getElementById('info-action-next-turn-button').classList.remove('disabled');
		} else {
			document.getElementById('info-action-next-turn-button').classList.add('disabled');
		}
	},

	generate_letter_tile_html: function(letter) {
		var letter_score = Game.distribution_data[letter].score_value;

		var letter_html = letter;
		var letter_score_html = letter_score;
		var blank_class = '';

		if( letter == '[blank]' ) {
			letter_html = '*';
			letter_score_html = '*';
			blank_class = 'is-blank';
		}

		return '<span class="letter-tile '+blank_class+'" '+
			'data-letter="'+letter+'" '+
			'data-score="'+letter_score+'">'+
				letter_html+
				'<sub>'+letter_score_html+'</sub>'+
			'</span>';
	},

	pick_letters_for_player: function(player_id) {
		var player = Game.players[player_id];
		var num_letters_to_draw = GAME_NUM_LETTERS_PER_PLAYER - player.letters_pool.length;

		for(var i = 0; i < num_letters_to_draw; i++) {
			var available_letters = Object.keys(Game.game_letters_pool);
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