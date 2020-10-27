 window.addEventListener('load', (event) => {
    const BALL_ACC = 0.01;
    const BALL_SPEED_NORMAL = 0.7;
    const BALL_SPEED_FAST = 1.8;
    const INFO_URL = "https://api.soundcloud.com/users/287905929/tracks?client_id=9e05e349251475056d1bc81acbf08c71&secret_token=track";

    const fs = document.getElementById("FSHADER_SOURCE").textContent;
    const canvas = document.getElementById("also-radio-canvas");
    canvas.width = canvas.clientWidth * 2.0;
    canvas.height = canvas.clientHeight * 2.0;
    const glslCanvas = new GlslCanvas(canvas);
    glslCanvas.load(fs);

    let tracks = [];
    let selectedTrack = 0;
    let isPlaying = false;
    let isStopped = true;
    let showingInfo = false;

    // Audio setup
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioCtx();
    const analyser = audioContext.createAnalyser();
    const audioElement = document.getElementById("also-radio-audio");
    const audioSource = audioContext.createMediaElementSource(audioElement);
    audioSource.connect(analyser);
    analyser.connect(audioContext.destination);
    analyser.fftSize = 1024;
    const bufferLength = analyser.frequencyBinCount;
    let dataArray = new Uint8Array(bufferLength);

    // Animation variables
    let ballSpeed = 0.2;
    let isDistorting = false;
    let isDistorting2 = 0.0;
    let isDistorting3 = 0.0;
    let isDistorting4 = 0.0;

    let lastTime = 0.0;
    let timestamp = 0.0;
    let startCurrentTime = 0.0;
    let currentTime = 0.0;

    // mouse move stuff
    let timeout;
    let hideControls = false;

    // dynamic framerate and frame locking
    let cssAnimating = false;
    let frameRateSum = 0;
    let frameCount = 0
    let numOffenses = 0;
    const MIN_FRAME_RATE = 45;
    const NUM_AVERAGE_FRAMES = 20;
    const FPS_LIMIT = 60;

    let previousTimestamp = 0;


    const setUniform = (name, value) => {
        try {
            glslCanvas.setUniform(name, value);
        } catch (e) {}
    }

    const getFormattedNumber = duration => {
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration - minutes * 60);
        const formattedMinutes = ("0" + minutes).slice(-2);
        const formattedSeconds = ("0" + seconds).slice(-2);
        return `${formattedMinutes}:${formattedSeconds}`;
    }

    const playerTitleElement = document.getElementById("player-title");
    const timecodeRightElement = document.getElementById("player-timecode--right");
    const descriptionElement = document.getElementById("player-description");
    const playerElement = document.getElementById("player");

    const updateUIInfo = () => {
        const track = tracks[selectedTrack];
        playerTitleElement.innerHTML = track.title;
        timecodeRightElement.innerHTML = getFormattedNumber(track.duration / 1000);
        descriptionElement.innerHTML = track.description;
        if (hideControls) {
            playerElement.classList.add("player--hidden");
        } else {
            playerElement.classList.remove("player--hidden");
        }
    }

    const buttonElement = document.getElementById("player-button");
    const updatePlayerButton = () => {
        if (isPlaying) {
            buttonElement.classList.add("player-button--play");
            buttonElement.classList.remove("player-button--pause");
        } else {
            buttonElement.classList.add("player-button--pause");
            buttonElement.classList.remove("player-button--play");
        }
    }

    const fetchTrackInfo = async() => {
        const response = await fetch(INFO_URL);

        if (!response.ok) {
            document.getElementById("also-radio-error").classList.add("also-radio-error--show");
            return;
        }

        const data = await response.json();
        tracks = await Promise.all(data.map(async track => {
            const streamsResponse = await fetch(getStreamsUrl(track.id));
            const streamsData = await streamsResponse.json();

            const t = {
                id: track.id,
                title: track.title,
                description: track.description,
                duration: track.duration,
                streamUrl: streamsData.http_mp3_128_url,
            }

            return t;
        }));

        updateUIInfo();
    }

    const getStreamsUrl = (trackId) => (
        `https://api.soundcloud.com/tracks/${trackId}/streams?client_id=9e05e349251475056d1bc81acbf08c71`
    );

    const play = (pausedAt) => {
        startCurrentTime = timestamp;
        if (isPlaying) {
            pause()
            return;
        }

        if (tracks[selectedTrack]) {
            audioElement.src = tracks[selectedTrack].streamUrl;
            audioContext.resume();
            if (pausedAt) {
                audioElement.currentTime = pausedAt;
            }
            audioElement.play();
            isPlaying = true;
            isStopped = false;
        }
        updatePlayerButton();
        setUniform("u_playing", 1);
    }

    const pause = (stop) => {
        if (tracks[selectedTrack]) {
            audioElement.pause();
            isPlaying = false;
        }
        updatePlayerButton();
        setUniform("u_playing", 0);
    }

    const stop = () => {
        audioElement.pause();
        audioElement.currentTime = 0;
        isStopped = true;
        isPlaying = false;
        updatePlayerButton();
        setUniform("u_playing", 0);
    }

    const handleNextTrackClick = () => {
        selectedTrack += 1;

        if (selectedTrack >= tracks.length) {
            selectedTrack = tracks.length - 1;
        }
        stop();
        updateUIInfo();
    }

    const handlePreviousTrackClick = (trackIndex) => {
        selectedTrack -= 1;

        if (selectedTrack < 0) {
            selectedTrack = 0;
        }
        stop();
        updateUIInfo();
    }

    const handleInfoClick = () => {
        const descriptionElement = document.getElementById("player-description");
        const buttonElement = document.getElementById("player-info");
        if (showingInfo) {
            descriptionElement.classList.add("player-description--hidden")
            buttonElement.innerHTML = "˅ info"
            showingInfo = false;
        } else {
            descriptionElement.classList.remove("player-description--hidden")
            buttonElement.innerHTML = "˄ info"
            showingInfo = true;
        }
    }

    function throttled(delay, fn) {
        let lastCall = 0;
        return function(...args) {
            const now = (new Date).getTime();
            if (now - lastCall < delay) {
                return;
            }
            lastCall = now;
            return fn(...args);
        }
    }

    const handleMouseMove = () => {
        if (timeout) {
            window.clearTimeout(timeout);
        }

        timeout = window.setTimeout(() => {
            if (isPlaying) {
                cssAnimating = true;
                // We dont want wonky css animations
                // to mess with the dynamic resolution
                window.setTimeout(() => {
                    cssAnimating = false;
                }, 3000);

                hideControls = true;
                updateUIInfo();
            }
        }, 3000);

        if (hideControls) {
            cssAnimating = true;
            window.setTimeout(() => {
                cssAnimating = false;
            }, 3000);
            hideControls = false;
            updateUIInfo();
        }
    }

    const registerEventHandlers = () => {
        document.getElementById("player-button").onclick = () => {
            audioContext.resume();
            if (isStopped) {
                play()
            } else {
                play(audioElement.currentTime);
            }
        };
        document.getElementById("player-next").onclick = handleNextTrackClick;
        document.getElementById("player-previous").onclick = handlePreviousTrackClick;
        document.getElementById("player-info").onclick = handleInfoClick;

        window.addEventListener("mousemove", throttled(200, handleMouseMove));
    }

    const setInitialUniformValues = () => {
        setUniform("u_texture", "https://res.cloudinary.com/do4zvxwb9/image/upload/v1603553822/logo_k9gbdp.jpg")
        setUniform("u_ballSpeed", ballSpeed);
        setUniform("u_tod", 1);
        setUniform("u_playing", 0);
    }

    const updateUniforms = () => {
        // Audio analyzer uniforms
        analyser.getByteFrequencyData(dataArray);

        const bass = dataArray.slice(0, 4).reduce((acc, e) => acc + e) / 4;
        const mid = dataArray.slice(100, 300).reduce((acc, e) => acc + e) / 199;
        const high = dataArray.slice(300, 500).reduce((acc, e) => acc + e) / 199;

        setUniform("u_bass", bass / 255);
        setUniform("u_mid", mid / 255);
        setUniform("u_high", high / 255);
        setUniform("u_distort", audioElement.currentTime % 20 > 15 ? 1 : 0);

        setUniform("u_distort", isDistorting);
        setUniform("u_distort_2", isDistorting2);
        setUniform("u_distort_3", isDistorting3);
        setUniform("u_distort_4", isDistorting4);

        setUniform("u_ballSpeed", ballSpeed);
        setUniform("u_currentTime", currentTime);

        // Time of day
        if (audioElement.currentTime && audioElement.duration) {
            // From night to day to night again
            const progress = 1 - (audioElement.currentTime / audioElement.duration);
            let tod = 0;
            if (progress > 0.5) {
                tod = Math.min(1., progress * 1.2);
            } else {
                tod = Math.min(1., 1 - (progress * 1.2));
            }
            setUniform("u_tod", tod);
        }
    }

    const updateAnimationVariables = (timestamp) => {
        // We need a higher resolution currentTime
        // than audioElement.currentTime for smooth animations
        if (isPlaying) {
            currentTime = (timestamp - startCurrentTime) / 1000;
        }

        // Start animation
        if (isPlaying && ballSpeed < BALL_SPEED_NORMAL) {
            ballSpeed += BALL_ACC;
            if (ballSpeed > BALL_SPEED_NORMAL) {
                ballSpeed = BALL_SPEED_NORMAL;
            }
        }

        if (isPlaying && !isDistorting && ballSpeed > BALL_SPEED_NORMAL) {
            ballSpeed = BALL_SPEED_NORMAL;
        }

        // Distortion animation
        if (isPlaying && audioElement.currentTime % 25 > 16) {
            ballSpeed = BALL_SPEED_FAST;
            isDistorting = true;
        } else {
            isDistorting = false;
        }

        if (isPlaying && audioElement.currentTime % 180 > 160) {
            isDistorting2 += 0.01;
            if (isDistorting2 >= 1) {
                isDistorting2 = 1
            }
        } else {
            isDistorting2 -= 0.01;
            if (isDistorting2 <= 0) {
                isDistorting2 = 0
            }
        }

        if (isPlaying && audioElement.currentTime % 230 > 210) {
            isDistorting3 += 0.01;
            if (isDistorting3 >= 1) {
                isDistorting3 = 1
            }
        } else {
            isDistorting3 -= 0.01;
            if (isDistorting3 <= 0) {
                isDistorting3 = 0
            }
        }
        const songProgress = (audioElement.currentTime / audioElement.duration);
        if (songProgress > 0.43 && songProgress < 0.58 && isPlaying) {
            isDistorting4 += 0.006;
            if (isDistorting4 >= 1) {
                isDistorting4 = 1
            }
        } else {
            isDistorting4 -= 0.006;
            if (isDistorting4 <= 0) {
                isDistorting4 = 0
            }
        }
        updateUniforms();
    }

    // Dynamic resolution
    const checkFps = timestamp => {
        const fps = 1 / ((timestamp - lastTime) / 1000);

        frameRateSum += fps
        frameCount += 1;

        if (frameCount === NUM_AVERAGE_FRAMES) {
            const framerate = Math.floor(frameRateSum / NUM_AVERAGE_FRAMES);
            frameCount = 0;
            frameRateSum = 0;

            if (framerate && framerate < MIN_FRAME_RATE) {
                numOffenses += 1;

                if (numOffenses > 3) {
                    canvas.width /= 1.2;
                    canvas.height /= 1.2;
                    numOffenses = 0;
                }
            }
        }

        lastTime = timestamp;
    }

    const timecodeLeftElement = document.getElementById("player-timecode--left");
    const playheadElement = document.getElementById("player-timeline-playhead");

    function update(timestamp) {
        timestamp = timestamp;

        if (!cssAnimating) {
            checkFps(timestamp);
        }

        const delta = timestamp - previousTimestamp;
        if (delta > (1000 / FPS_LIMIT - 0.1)) {
            updateAnimationVariables(timestamp);
            previousTimestamp = timestamp;
        }

        // Update HTML
        timecodeLeftElement.innerHTML = getFormattedNumber(audioElement.currentTime);
        const percentage = (audioElement.currentTime / audioElement.duration) * 100;
        playheadElement.style.left = `${percentage}%`;
        window.requestAnimationFrame(update);

    }

    fetchTrackInfo();
    registerEventHandlers();
    setInitialUniformValues();
    update();
});
