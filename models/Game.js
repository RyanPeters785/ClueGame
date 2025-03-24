// models/Game.js
class Game {
    constructor() {
        this.players = [];
        this.started = false;
        this.solution = { suspect: null, weapon: null, room: null };
        this.cards = {
            suspects: ['Colonel Mustard', 'Professor Plum', 'Mr. Green', 'Mrs. Peacock', 'Miss Scarlet', 'Mrs. White'],
            weapons: ['Knife', 'Candlestick', 'Revolver', 'Rope', 'Lead Pipe', 'Wrench'],
            rooms: ['Kitchen', 'Ballroom', 'Conservatory', 'Dining Room', 'Billiard Room', 'Library', 'Lounge', 'Hall', 'Study']
        };
        this.playerCards = {}; // Maps player ID to their cards
        this.middleCards = []; // Cards placed in the middle (apart from solution)
    }

    addPlayer(id, name) {
        if (this.started) {
            return false;
        }
        this.players.push({ id, name });
        return true;
    }

    startGame() {
        if (this.players.length < 2) {
            return false; // Need at least 2 players
        }
        
        // Select solution cards
        this.solution = {
            suspect: this.getRandomCard(this.cards.suspects),
            weapon: this.getRandomCard(this.cards.weapons),
            room: this.getRandomCard(this.cards.rooms)
        };
        
        // Remove solution cards from deck
        const remainingSuspects = this.cards.suspects.filter(s => s !== this.solution.suspect);
        const remainingWeapons = this.cards.weapons.filter(w => w !== this.solution.weapon);
        const remainingRooms = this.cards.rooms.filter(r => r !== this.solution.room);
        
        // Combine all remaining cards
        let remainingCards = [...remainingSuspects, ...remainingWeapons, ...remainingRooms];
        
        // Shuffle cards
        remainingCards = this.shuffleArray(remainingCards);
        
        // Calculate how many cards each player should have
        const cardCount = Math.floor(remainingCards.length / this.players.length);
        const remainder = remainingCards.length % this.players.length;
        
        // Deal cards to players
        this.players.forEach((player, index) => {
            const playerCards = remainingCards.splice(0, cardCount + (index < remainder ? 1 : 0));
            this.playerCards[player.id] = playerCards;
        });
        
        // Any cards left go to the middle
        this.middleCards = remainingCards;
        
        this.started = true;
        return true;
    }

    getPlayerCards(playerId) {
        return this.playerCards[playerId] || [];
    }

    getRandomCard(cards) {
        return cards[Math.floor(Math.random() * cards.length)];
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    getGameState(playerId) {
        // Return appropriate game state based on who's asking
        const isHost = !playerId;
        
        return {
            started: this.started,
            players: this.players,
            cards: this.cards,
            playerCards: isHost ? null : this.getPlayerCards(playerId),
            knownCards: isHost ? null : [...this.getPlayerCards(playerId), ...this.middleCards],
            solution: isHost ? null : null // Never reveal solution
        };
    }

    getAllCards() {
        return {
            suspects: this.cards.suspects,
            weapons: this.cards.weapons,
            rooms: this.cards.rooms
        };
    }
}

module.exports = Game;