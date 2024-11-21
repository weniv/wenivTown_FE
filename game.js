// game.js
class Game {
    constructor() {
        this.setupLoginModal();
        this.setupChat();
    }

    setupChat() {
        const chatContainer = document.getElementById('chatContainer');
        const chatInput = document.getElementById('chatInput');
        const chatMessages = document.getElementById('chatMessages');

        // Enter 키로 채팅 모드 전환
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !this.isChatting) {
                e.preventDefault();
                chatContainer.style.display = 'block';
                chatInput.focus();
                this.isChatting = true;
            }
        });

        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (chatInput.value.trim()) {
                    // 메시지 전송 로직
                    this.ws.send(JSON.stringify({
                        type: 'chat',
                        message: chatInput.value.trim(),
                        sender: this.playerName,
                        client_id: this.clientId,
                    }));

                    this.myCharacter.showMessage(chatInput.value.trim());
                    this.addChatMessage(this.playerName, chatInput.value.trim(), true);
                }
                
                chatInput.value = '';
                chatContainer.style.display = 'none';
                this.isChatting = false;
                // 채팅 종료 후 게임 영역으로 포커스 이동
                document.getElementById('gameArea').focus();
            } else if (e.key === 'Escape') {
                // ESC로 채팅 취소
                chatInput.value = '';
                chatContainer.style.display = 'none';
                this.isChatting = false;
                document.getElementById('gameArea').focus();
            }
            e.stopPropagation(); // 이벤트 전파 방지
        });

        chatContainer.addEventListener('click', () => {
            chatInput.focus();
        });
    }

    addChatMessage(sender, message, isMe = false) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.style.backgroundColor = isMe ? '#e3f2fd' : '#f5f5f5';
        messageDiv.innerHTML = `
            <span class="sender">${sender}:</span>
            <span class="message">${message}</span>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    setupLoginModal() {
        const startButton = document.getElementById('startGame');
        const characterOptions = document.querySelectorAll('.character-option');
        let selectedCharacter = 'licat';

        characterOptions.forEach(option => {
            option.addEventListener('click', () => {
                characterOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                selectedCharacter = option.dataset.character;
            });
        });

        startButton.addEventListener('click', () => {
            const playerName = document.getElementById('playerName').value;
            const roomId = document.getElementById('roomId').value;

            if (playerName && roomId) {
                document.getElementById('loginModal').style.display = 'none';
                document.getElementById('gameArea').style.display = 'block';
                this.initGame(playerName, roomId, selectedCharacter);
            }
        });
    }

    initGame(playerName, roomId, characterType) {
        this.clientId = Math.random().toString(36).substr(2, 9);
        this.ws = new WebSocket(`ws://localhost:8000/ws/${roomId}/${this.clientId}`);
        this.characters = new Map();
        this.myCharacter = null;
        this.moveSpeed = 5;
        this.isChatting = false;

        this.playerName = playerName;
        this.characterType = characterType;
        this.roomId = roomId;

        this.setupWebSocket();
        this.setupControls();
    }

    setupWebSocket() {
        this.ws.onopen = () => {
            console.log('WebSocket 연결 성공!');
            this.createMyCharacter();
        };
    
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'chat') {
                // 채팅 메시지 처리
                if (data.client_id !== this.clientId) {
                    // 다른 플레이어의 캐릭터에 말풍선 표시
                    const character = this.characters.get(data.client_id);
                    if (character) {
                        character.showMessage(data.message);
                    }
                    
                    // 채팅창에 메시지 추가
                    this.addChatMessage(data.sender, data.message);
                }
            }
            else if (data.type === 'init') {
                // players 배열이 존재하는지 확인
                if (data.players && Array.isArray(data.players)) {
                    data.players.forEach(player => {
                        if (player.clientId !== this.clientId) {
                            this.updateOtherCharacter(player);
                        }
                    });
                }
            } else {
                this.updateOtherCharacter(data);
            }
        };
    
        this.ws.onerror = (error) => {
            console.error('WebSocket 에러:', error);
        };
    
        this.ws.onclose = () => {
            console.log('WebSocket 연결 종료');
        };
    }

    createMyCharacter() {
        const x = Math.random() * (window.innerWidth - 50);
        const y = Math.random() * (window.innerHeight - 50);
        this.myCharacter = new Character(x, y, this.clientId, this.characterType, this.playerName);
        
        // 새 플레이어 정보 서버에 전송
        this.ws.send(JSON.stringify({
            type: 'init',
            clientId: this.clientId,
            x: x,
            y: y,
            direction: 'down',
            characterType: this.characterType,
            name: this.playerName
        }));
    }

    updateOtherCharacter(data) {
        if (!this.characters.has(data.client_id)) {
            // characterType과 name 정보를 사용하도록 수정
            const character = new Character(
                data.x, 
                data.y, 
                data.client_id,
                data.characterType || 'licat',  // characterType이 없을 경우 기본값
                data.name || ''  // name이 없을 경우 기본값
            );
            this.characters.set(data.client_id, character);
        } else {
            const character = this.characters.get(data.client_id);
            character.move(data.x, data.y, data.direction);
        }
    }

    setupControls() {
        document.addEventListener('keydown', (e) => {
            // 채팅 중일 때는 캐릭터 이동 비활성화
            if (this.isChatting) return;

            let moved = false;
            let newX = this.myCharacter.x;
            let newY = this.myCharacter.y;
            let direction = this.myCharacter.direction;

            switch (e.key) {
                case 'ArrowUp':
                    newY -= this.moveSpeed;
                    direction = 'up';
                    moved = true;
                    break;
                case 'ArrowDown':
                    newY += this.moveSpeed;
                    direction = 'down';
                    moved = true;
                    break;
                case 'ArrowLeft':
                    newX -= this.moveSpeed;
                    direction = 'left';
                    moved = true;
                    break;
                case 'ArrowRight':
                    newX += this.moveSpeed;
                    direction = 'right';
                    moved = true;
                    break;
            }

            if (moved) {
                this.myCharacter.move(newX, newY, direction);
                this.ws.send(JSON.stringify({
                    x: newX,
                    y: newY,
                    direction: direction,
                    characterType: this.characterType,
                    name: this.playerName,
                    client_id: this.clientId
                }));
            }
        });
    }
    
}

// 게임 시작
window.onload = () => {
    const game = new Game();
};