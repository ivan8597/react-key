import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as TWEEN from '@tweenjs/tween.js';
import './App.css';

interface Riddle {
  id: number;
  question: string;
  answer: string;
  type: 'hut' | 'bunker' | 'bulldog' | 'final_riddle';
}

type GameState = 'explore' | 'hut' | 'bunker' | 'shop' | 'final_riddle' | 'bulldog_riddle' | 'rps_game';
type RPSChoice = 'rock' | 'paper' | 'scissors';

const App = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isSceneReadyRef = useRef<boolean>(false);
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});
  const clickableObjectsRef = useRef<THREE.Object3D[]>([]);
  const playerRef = useRef<THREE.Object3D | null>(null);
  const hutRef = useRef<THREE.Object3D | null>(null);
  const hutInteriorBBoxRef = useRef<THREE.Box3 | null>(null);
  const [message, setMessage] = useState<string>('');
  const [keys, setKeys] = useState<number>(0);
  const [coins, setCoins] = useState<number>(5);
  const [gameState, setGameState] = useState<GameState>('explore');
  const [currentRiddle, setCurrentRiddle] = useState<Riddle | null>(null);
  const [shopOpen, setShopOpen] = useState<boolean>(false);
  const [finalKeyObtained, setFinalKeyObtained] = useState<boolean>(false);
  const [showRPSButtons, setShowRPSButtons] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('Инициализация...');

  const riddles: Riddle[] = [
    { id: 1, question: "Что всегда идет, но никогда не приходит?", answer: "время", type: 'bulldog' },
    { id: 2, question: "Что можно увидеть с закрытыми глазами?", answer: "сон", type: 'hut' },
    { id: 3, question: "Чем больше берешь, тем больше становится.", answer: "яма", type: 'bunker' },
    { id: 4, question: "Что принадлежит вам, но другие используют это чаще, чем вы?", answer: "имя", type: 'final_riddle' },
  ];

  useEffect(() => {
    if (!window.WebGLRenderingContext || !THREE.WebGLRenderer) {
      setStatus('WebGL не поддерживается вашим браузером.');
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0d8ef);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
      setStatus('Рендерер добавлен');
    } else {
      setStatus('Ошибка: mountRef не найден');
      return;
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 50, 0);
    scene.add(directionalLight);

    const textureLoader = new THREE.TextureLoader();
    let ground: THREE.Mesh;
    try {
      const grassTexture = textureLoader.load(
        '/textures/grass.jpg',
        () => setStatus('Текстура травы загружена'),
        undefined,
        (error) => {
          const message = error && typeof error === 'object' && 'message' in error ? error.message : 'Неизвестная ошибка при загрузке текстуры';
          setStatus(`Ошибка загрузки текстуры травы: ${message}`);
        }
      );
      grassTexture.wrapS = THREE.RepeatWrapping;
      grassTexture.wrapT = THREE.RepeatWrapping;

      const groundGeometry = new THREE.PlaneGeometry(200, 200);
      const groundMaterial = new THREE.MeshStandardMaterial({ map: grassTexture, side: THREE.DoubleSide });
      ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.5;
      scene.add(ground);
    } catch (e) {
      setStatus('Ошибка настройки земли: ' + (e instanceof Error ? e.message : 'Неизвестная ошибка'));
    }

    const loader = new GLTFLoader();
    let wizard: THREE.Object3D | undefined;
    let bulldog: THREE.Object3D | undefined;
    const stones: THREE.Object3D[] = [];
    const clock = new THREE.Clock();
    const clickableObjects = clickableObjectsRef.current;
    clickableObjects.length = 0;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let animationFrameId: number;
    const moveSpeed = 0.1;

    let loadedModels = 0;
    const totalModelsCorrect = 6;

    const modelLoaded = (success: boolean, modelName: string) => {
      loadedModels++;
      setStatus(`Загружено моделей: ${loadedModels}/${totalModelsCorrect} (${modelName} ${success ? 'успешно' : 'с ошибкой'})`);
      if (loadedModels === totalModelsCorrect) {
        isSceneReadyRef.current = true;
        setStatus('Сцена готова!');
        if (hutRef.current) {
          const hutDoor = hutRef.current.getObjectByName('DoorAndWindow');
          if (hutDoor) {
            hutDoor.userData.type = 'hutDoor';
            clickableObjects.push(hutDoor);
            hutInteriorBBoxRef.current = new THREE.Box3().setFromObject(hutRef.current);
          } else {
            setStatus("Ошибка: дверь избушки ('DoorAndWindow') не найдена!");
          }
        }
      }
    };

    loader.load(
      '/models/player.glb',
      (gltf) => {
        playerRef.current = gltf.scene;
        playerRef.current.scale.set(1.9, 1.9, 1.9);
        playerRef.current.position.set(0, 0, 10);
        scene.add(playerRef.current);
        modelLoaded(true, 'player');
      },
      undefined,
      (error) => {
        setStatus('Ошибка загрузки игрока: ' + (error.message || 'Неизвестная ошибка'));
        modelLoaded(false, 'player');
      }
    );

    loader.load(
      '/models/hut.glb',
      (gltf) => {
        hutRef.current = gltf.scene;
        hutRef.current.position.set(10, 0, 10);
        hutRef.current.scale.set(2, 2, 2);
        scene.add(hutRef.current);
        modelLoaded(true, 'hut');
      },
      undefined,
      (error) => {
        setStatus('Ошибка загрузки избушки: ' + (error.message || 'Неизвестная ошибка'));
        modelLoaded(false, 'hut');
      }
    );

    for (let i = 0; i < 3; i++) {
      loader.load(
        '/models/stone.glb',
        (gltf) => {
          const stone = gltf.scene;
          stone.position.set(Math.random() * 40 - 20, 0, Math.random() * 40 - 20);
          stone.scale.set(1.5, 1.5, 1.5);
          scene.add(stone);
          stone.userData.type = 'stone';
          stone.userData.id = `stone_${i}`;
          clickableObjects.push(stone);
          stones.push(stone);
          modelLoaded(true, `stone_${i}`);
        },
        undefined,
        (error) => {
          setStatus(`Ошибка загрузки камня ${i}: ` + (error.message || 'Неизвестная ошибка'));
          modelLoaded(false, `stone_${i}`);
        }
      );
    }

    loader.load(
      '/models/wizard.glb',
      (gltf) => {
        wizard = gltf.scene;
        wizard.position.set(5, 0, -5);
        wizard.scale.set(2, 2, 2);
        scene.add(wizard);
        clickableObjects.push(wizard);
        wizard.userData.type = 'wizard';
        modelLoaded(true, 'wizard');
      },
      undefined,
      (error) => {
        setStatus('Ошибка загрузки волшебника: ' + (error.message || 'Неизвестная ошибка'));
        modelLoaded(false, 'wizard');
      }
    );

    loader.load(
      '/models/bulldog.glb',
      (gltf) => {
        bulldog = gltf.scene;
        bulldog.position.set(-5, 0, 5);
        bulldog.scale.set(3, 3, 3);
        scene.add(bulldog);
        clickableObjects.push(bulldog);
        bulldog.userData.type = 'bulldog';
        modelLoaded(true, 'bulldog');
      },
      undefined,
      (error) => {
        setStatus('Ошибка загрузки бульдога: ' + (error.message || 'Неизвестная ошибка'));
        modelLoaded(false, 'bulldog');
      }
    );

    const checkCollision = (newPosition: THREE.Vector3): boolean => {
      // --- Возвращаем логику проверки столкновений --- 
      if (!hutRef.current || !playerRef.current || !hutInteriorBBoxRef.current) return false; // Используем рефы
      
      const hutBBox = hutInteriorBBoxRef.current; // Используем реф
      const playerSize = 1.2;
      
      const doorMinX = 11.0;
      const doorMaxX = 12.0;
      const doorMinZ = 9.8;
      const doorMaxZ = 10.2;
      const doorMaxY = 2.5;
      
      const checkObjectCollision = (box: THREE.Box3) => {
        const collisionX = newPosition.x + playerSize > box.min.x && newPosition.x - playerSize < box.max.x;
        const collisionZ = newPosition.z + playerSize > box.min.z && newPosition.z - playerSize < box.max.z;
        const playerBottom = newPosition.y;
        const playerTop = newPosition.y + playerSize * 1.8;
        const collisionY = playerTop > box.min.y && playerBottom < box.max.y;
      
        if (collisionX && collisionZ && collisionY) {
          const isInDoorAreaX = newPosition.x > doorMinX && newPosition.x < doorMaxX;
          const isInDoorAreaZ = newPosition.z > doorMinZ && newPosition.z < doorMaxZ;
          const isInDoorAreaY = newPosition.y < doorMaxY;
      
          if (isInDoorAreaX && isInDoorAreaZ && isInDoorAreaY) {
            if (finalKeyObtained) {
                setStatus('Проход через дверь разрешен (есть ключ)');
                return false;
            } else {
                setStatus('Столкновение с дверью (нет ключа)');
                return true;
            }
          } else {
            setStatus('Столкновение со стеной');
            return true;
          }
        }
        return false;
      };
      
      return checkObjectCollision(hutBBox);
      // setStatus('Проверка столкновений временно отключена');
      // return false; // Всегда разрешаем движение для теста
      // --- Конец временной отладки ---
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressedRef.current[e.code] = true;
      setStatus(`Нажата клавиша: ${e.code}`); // Отладка
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.code] = false;
      setStatus(`Отпущена клавиша: ${e.code}`); // Отладка
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      console.log(`Animate loop running. Scene ready: ${isSceneReadyRef.current}, Player: ${!!playerRef.current}, BBox: ${!!hutInteriorBBoxRef.current}`); // Добавляем лог
      TWEEN.update(performance.now());

      renderer.render(scene, camera);

      if (!isSceneReadyRef.current || !playerRef.current || !hutInteriorBBoxRef.current) {
        console.log('Animate loop: returning early - scene not ready.'); // Лог раннего выхода
        return;
      }

      const delta = clock.getDelta();
      const currentKeys = keysPressedRef.current;
      const newPosition = playerRef.current.position.clone();
      let targetRotationY = playerRef.current.rotation.y;
      let isMoving = false;

      if (currentKeys['KeyW']) {
        newPosition.z -= moveSpeed;
        targetRotationY = Math.PI;
        isMoving = true;
      }
      if (currentKeys['KeyS']) {
        newPosition.z += moveSpeed;
        targetRotationY = 0;
        isMoving = true;
      }
      if (currentKeys['KeyA']) {
        newPosition.x -= moveSpeed;
        targetRotationY = Math.PI / 2;
        isMoving = true;
      }
      if (currentKeys['KeyD']) {
        newPosition.x += moveSpeed;
        targetRotationY = -Math.PI / 2;
        isMoving = true;
      }

      if (currentKeys['KeyW'] && currentKeys['KeyA']) targetRotationY = (Math.PI + Math.PI / 2) / 2;
      if (currentKeys['KeyW'] && currentKeys['KeyD']) targetRotationY = (Math.PI - Math.PI / 2) / 2;
      if (currentKeys['KeyS'] && currentKeys['KeyA']) targetRotationY = (0 + Math.PI / 2) / 2;
      if (currentKeys['KeyS'] && currentKeys['KeyD']) targetRotationY = (0 - Math.PI / 2) / 2;
      
      // console.log(`Animate: isMoving=${isMoving}, checkCollision result=${!checkCollision(newPosition)}`); // Лог перед проверкой движения

      if (isMoving && !checkCollision(newPosition)) {
        playerRef.current.position.copy(newPosition);
        setStatus(`Игрок движется: x=${newPosition.x.toFixed(2)}, z=${newPosition.z.toFixed(2)}`);
      }

      if (isMoving) {
        const currentRotation = playerRef.current.rotation.y;
        let deltaRot = targetRotationY - currentRotation;
        while (deltaRot <= -Math.PI) deltaRot += 2 * Math.PI;
        while (deltaRot > Math.PI) deltaRot -= 2 * Math.PI;
        playerRef.current.rotation.y += deltaRot * 0.1;
      }

      if (gameState === 'explore' && hutInteriorBBoxRef.current.containsPoint(playerRef.current.position)) {
        setGameState('final_riddle');
        setCurrentRiddle(riddles[3]);
        setMessage(`Вы вошли в избушку! ${riddles[3].question}`);
        camera.position.set(10, 3, 12);
        camera.lookAt(10, 1, 7);
        controls.target.set(10, 1, 7);
        setShowRPSButtons(false);
      }

      if (gameState === 'explore') {
        const cameraOffset = new THREE.Vector3(0, 5, 5);
        if (playerRef.current) {
          const desiredPosition = playerRef.current.position.clone().add(cameraOffset.applyQuaternion(playerRef.current.quaternion));
          camera.position.lerp(desiredPosition, 0.05);
          controls.target.copy(playerRef.current.position);
        }
      }

      controls.update();
    };
    animate();

    const handleClick = (event: MouseEvent) => {
      if (!camera || !mountRef.current || !isSceneReadyRef.current || !playerRef.current || !ground) {
        setStatus('Клик не обработан: сцена/игрок/земля не готовы');
        return;
      }

      const rect = mountRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersectsClickable = raycaster.intersectObjects(clickableObjectsRef.current, true);

      if (intersectsClickable.length > 0) {
        let clickedObject = intersectsClickable[0].object;
        while (clickedObject.parent && !clickedObject.userData.type) {
          clickedObject = clickedObject.parent;
        }
        const object = clickedObject;

        setStatus(`Клик по интерактивному объекту: ${object.userData.type || 'неизвестно'}`);
        TWEEN.removeAll();

        if (object.userData.type === 'wizard') {
          setMessage('Волшебник: Привет! Хочешь купить финальный ключ за 9 монет?');
          setShopOpen(true);
          setGameState('shop');
          setShowRPSButtons(false);
        } else if (object.userData.type === 'bulldog') {
          setGameState('rps_game');
          setMessage('Бульдог: Гав! Сыграем в Камень-Ножницы-Бумага? Выбирай!');
          setShowRPSButtons(true);
          setCurrentRiddle(null);
          setShopOpen(false);
        } else if (object.userData.type === 'hutDoor') {
          if (!finalKeyObtained) {
            setMessage('Эта дверь заперта. Нужен финальный ключ!');
          } else {
            setMessage('У вас есть ключ, можете проходить.');
            const openDoor = (doorContainer: THREE.Object3D, openRotationY: number = Math.PI / 2) => {
              console.log(`Attempting to animate door. Container: Name='${doorContainer.name}', Children=${doorContainer.children.length}`, doorContainer);
              
              // Пытаемся анимировать ПЕРВОГО РЕБЕНКА, если он есть, иначе - сам контейнер
              const targetObject = doorContainer.children.length > 0 ? doorContainer.children[0] : doorContainer;
              console.log('Animating target object:', targetObject);

              new TWEEN.Tween(targetObject.rotation) // Анимируем вращение целевого объекта
                .to({ y: openRotationY }, 500)
                .easing(TWEEN.Easing.Quadratic.Out)
                .start();
            };
            openDoor(object); // Передаем найденный 'DoorAndWindow' как контейнер
          }
        } else if (object.userData.type === 'stone') {
          setMessage('Вы нашли монетку!');
          setCoins((prev) => prev + 1);
          const stoneToRemove = object;
          scene.remove(stoneToRemove);
          const index = clickableObjectsRef.current.indexOf(stoneToRemove);
          if (index > -1) {
            clickableObjectsRef.current.splice(index, 1);
          }
          const stoneIndex = stones.findIndex((s) => s.userData.id === stoneToRemove.userData.id);
          if (stoneIndex > -1) {
            stones.splice(stoneIndex, 1);
          }
          setShowRPSButtons(false);
        } else {
          setShowRPSButtons(false);
        }
      } else {
        setStatus('Клик: нет пересечений с интерактивными объектами');
        setShowRPSButtons(false);
      }
    };

    mountRef.current?.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);

      if (mountRef.current && renderer.domElement) {
        try {
          mountRef.current.removeChild(renderer.domElement);
        } catch (e) {
          setStatus('Ошибка удаления canvas: ' + (e instanceof Error ? e.message : 'Неизвестная ошибка'));
        }
      }
      scene.children.forEach((child) => scene.remove(child));
      renderer.dispose();
      mountRef.current?.removeEventListener('click', handleClick);
      setStatus('Сцена очищена');
    };
  }, []);

  const handleRPSChoice = (playerChoice: RPSChoice) => {
    const choices: RPSChoice[] = ['rock', 'paper', 'scissors'];
    const computerChoice = choices[Math.floor(Math.random() * choices.length)];

    let resultMessage = `Вы выбрали ${translateRPS(playerChoice)}, Бульдог выбрал ${translateRPS(computerChoice)}.`;

    if (playerChoice === computerChoice) {
      resultMessage += ' Ничья! Гав!';
    } else if (
      (playerChoice === 'rock' && computerChoice === 'scissors') ||
      (playerChoice === 'scissors' && computerChoice === 'paper') ||
      (playerChoice === 'paper' && computerChoice === 'rock')
    ) {
      resultMessage += ' Вы выиграли! Гав-гав! Получите 9 монет.';
      setCoins((prev) => prev + 9);
    } else {
      resultMessage += ' Вы проиграли! Рррр!';
    }

    setMessage(resultMessage);
    setShowRPSButtons(false);
  };

  const translateRPS = (choice: RPSChoice): string => {
    if (choice === 'rock') return 'Камень';
    if (choice === 'paper') return 'Бумага';
    if (choice === 'scissors') return 'Ножницы';
    return '';
  };

  const handleRiddleAnswer = () => {
    const answerInput = document.getElementById('riddle-answer') as HTMLInputElement;
    if (!answerInput || !currentRiddle) return;

    const userAnswer = answerInput.value.trim().toLowerCase();
    if (userAnswer === currentRiddle.answer) {
      setMessage('Правильно!');
      if (currentRiddle.type === 'hut' || currentRiddle.type === 'bunker') {
        setKeys((prev) => prev + 1);
        setMessage('Правильно! Вы получили ключ.');
      } else if (currentRiddle.type === 'bulldog') {
        setCoins((prev) => prev + 2);
        setMessage('Правильно! Получите 2 монеты.');
      }
      setCurrentRiddle(null);
      setGameState('explore');
    } else {
      setMessage('Неправильно, попробуй еще раз.');
    }
    answerInput.value = '';
  };

  const handleBuyKey = () => {
    if (coins >= 9) {
      setCoins((prev) => prev - 9);
      setFinalKeyObtained(true);
      setMessage('Поздравляю! Вы купили финальный ключ. Похоже, он может открыть что-то важное...');
      setShopOpen(false);
      setGameState('explore');
    } else {
      setMessage('У вас недостаточно монет.');
    }
  };

  const handleFinalRiddleAnswer = () => {
    const answerInput = document.getElementById('final-riddle-answer') as HTMLInputElement;
    if (!answerInput || !currentRiddle || currentRiddle.type !== 'final_riddle') return;

    const userAnswer = answerInput.value.trim().toLowerCase();
    if (userAnswer === currentRiddle.answer) {
      setMessage('ПОЗДРАВЛЯЮ! Вы разгадали все загадки и прошли игру!');
      setGameState('explore');
    } else {
      setMessage('Неверный ответ на финальную загадку...');
    }
    answerInput.value = '';
  };

  return (
    <div className="App">
      <div className="status-box">{status}</div>
      <div ref={mountRef} className="game-container" />
      {message && <div className="message-box">{message}</div>}

      <div className="stats-box">
        <div>Ключи: {keys}</div>
        <div>Монеты: {coins}</div>
        {finalKeyObtained && <div>Финальный ключ: ✓</div>}
      </div>

      {currentRiddle && gameState !== 'final_riddle' && gameState !== 'rps_game' && (
        <div className="riddle-box">
          <p>{currentRiddle.question}</p>
          <input type="text" id="riddle-answer" placeholder="Ваш ответ" />
          <button onClick={handleRiddleAnswer}>Ответить</button>
          <button
            onClick={() => {
              setCurrentRiddle(null);
              setMessage('');
              setGameState('explore');
            }}
          >
            Закрыть
          </button>
        </div>
      )}

      {shopOpen && gameState === 'shop' && (
        <div className="shop-box">
          <p>Купить финальный ключ за 9 монет?</p>
          <button onClick={handleBuyKey} disabled={finalKeyObtained || coins < 9}>
            {finalKeyObtained ? 'Уже куплено' : 'Купить'}
          </button>
          <button
            onClick={() => {
              setShopOpen(false);
              setMessage('');
              setGameState('explore');
            }}
          >
            Закрыть
          </button>
        </div>
      )}

      {gameState === 'final_riddle' && currentRiddle && (
        <div className="riddle-box final-riddle">
          <p>Финальная Загадка: {currentRiddle.question}</p>
          <input type="text" id="final-riddle-answer" placeholder="Финальный ответ" />
          <button onClick={handleFinalRiddleAnswer}>Ответить</button>
        </div>
      )}

      {gameState === 'rps_game' && (
        <div className="rps-box">
          {showRPSButtons && (
            <div className="rps-choices">
              <button onClick={() => handleRPSChoice('rock')}>Камень</button>
              <button onClick={() => handleRPSChoice('paper')}>Бумага</button>
              <button onClick={() => handleRPSChoice('scissors')}>Ножницы</button>
            </div>
          )}
          <button
            onClick={() => {
              setGameState('explore');
              setMessage('');
              setShowRPSButtons(false);
            }}
          >
            Закрыть
          </button>
        </div>
      )}
    </div>
  );
};

export default App;