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


		/* Generate board node and inner board cells */
		Game.generate_board_node();


		/* Generate info-pane node */
		var info_pane_node = document.createElement('div');
		info_pane_node.setAttribute('id', 'info-pane');

		var info_pane_html = 
			'<div id="info-block-current-turn" class="info-block">'+
				'<h3>Joueur actif</h3>'+
				'<div id="info-current-player-name-value"></div>'+
			'</div>'+
			'<div id="info-block-player-letters" class="info-block">'+
				'<h3>Vos lettres</h3>'+
				'<div class="info-player-letters-holder">'+
					'<div id="info-player-letters-value"></div>'+
				'</div>'+
			'</div>';
		info_pane_node.innerHTML = info_pane_html;
		Game.root_node.appendChild(info_pane_node);

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

		for(var i = 0; i < Game.players.length; i++) {
			Game.players[i].current_score = 0;
			Game.players[i].letters_pool = [];
		}


		/* Select starting player randomly */
		var starting_player_id = Game.get_random_player_id();
		Game.set_playing_player(starting_player_id);


		/* Init UX vendor libraries */
		Game.init_ux_libraries();
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
				var cell_index = i + j * GAME_NUM_CELLS_PER_SIDE;
				inner_board_html += '<div class="cell" data-index="'+cell_index+'" data-letter=""></div>';
			}

			inner_board_html += '<div style="clear: both;"></div>';
		}

		inner_board_html += '</div>'; // Closing .inner-wrapper

		Game.board_node.innerHTML = inner_board_html;

		Game.root_node.appendChild(Game.board_node);
	},

	init_ux_libraries: function() {

		var dragged_letter_index_in_player_pool;
		var droppable_target = null;
		var draggable_start_pos = {x: 0, y: 0};

		/* Dragging letters from player pool */
		interact('#info-block-player-letters .letter-tile')
		.draggable({
			inertia: false,
			autoScroll: true,

			onstart: function(event) {
				droppable_target = null;
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

				if( droppable_target ) {
					droppable_target.appendChild(draggableTarget);
					droppable_target.classList.remove('droppable-over');

					droppable_target.setAttribute('data-letter', draggableTarget.getAttribute('data-letter'));

					Game.current_playing_player.letters_pool.splice(dragged_letter_index_in_player_pool, 1);
				}

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
				//draggableElement.classList.add('can-drop');
			},

			ondragleave: function (event) {
				var draggableElement = event.relatedTarget,
				    dropzoneElement = event.target;

				dropzoneElement.classList.remove('droppable-over');
				//draggableElement.classList.remove('can-drop');
			},

			ondrop: function (event) {
				var draggableElement = event.relatedTarget,
				    dropzoneElement = event.target;
				
				// @TODO: Check the cell is free before setting dragndrop_success to true
				droppable_target = dropzoneElement;

				/* The actual tile placement takes place in draggable.onend callback */
			}
		})
	},


	/*******************
	* GAMEPLAY METHODS *
	********************/

	get_random_player_id: function() {
		return Math.floor(Math.random() * Game.players.length);
	},

	set_playing_player: function(player_id) {
		Game.current_playing_player = Game.players[player_id];
		document.getElementById('info-current-player-name-value').innerHTML = Game.current_playing_player.name;

		Game.draw_letters_for_player(player_id);
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
				'<sub>'+letter_score_html+'</sub>'
			'</span>';
	},

	draw_letters_for_player: function(player_id) {
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

			var info_letters_div_html = document.getElementById('info-player-letters-value').innerHTML;

			document.getElementById('info-player-letters-value').innerHTML = info_letters_div_html + Game.generate_letter_tile_html(selected_letter);
		}
	}
}