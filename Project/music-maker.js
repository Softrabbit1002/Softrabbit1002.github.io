let currentAudioObj = null;
let isPaused = false;
let mediaRecorder;
let recordedChunks = [];
let audioCount = 1; // 用于给每个新添加的音频命名

function adjustVolume(audioElement, volume) {
    if (audioElement) {
        audioElement.volume = volume;
    }
}

function handleDragStart(event) {
    const instrument = event.target.getAttribute('data-instrument');
    const audioUrl = event.target.getAttribute('data-audio-url');
    if (instrument) {
        event.dataTransfer.setData('text', instrument);
    } else if (audioUrl) {
        event.dataTransfer.setData('audio-url', audioUrl);
    }
}


function handleDrop(event, trackDiv) {
    event.preventDefault();
    const instrument = event.dataTransfer.getData("text");
    const audioUrl = event.dataTransfer.getData("audio-url");

    // 创建一个音频元素
    const audio = document.createElement('audio');
    audio.controls = true;

    // 根据拖放的乐器设置音频源
    if (instrument) {
        const instrumentAudioMap = {
            'Bass': 'audio/bass.mp3',
            'Guitar': 'audio/guitar.mp3',
            'Drums': 'audio/drums.mp3',
            'Violin': 'audio/violin.mp3'
        };
        audio.src = instrumentAudioMap[instrument];
    } else if (audioUrl) {
        audio.src = audioUrl;
    }

    // 添加音量控制滑块
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = '0';
    volumeSlider.max = '1';
    volumeSlider.step = '0.01';
    volumeSlider.value = '1';
    volumeSlider.className = 'volume-slider'; // 添加一个类名以便于样式化
    volumeSlider.oninput = function() {
        adjustVolume(audio, volumeSlider.value); // 调整特定音频元素的音量
    };
    trackDiv.appendChild(volumeSlider);

    // 添加音频元素到轨道
    trackDiv.appendChild(audio);

    // 创建一个进度条元素
    const progress = document.createElement('progress');
    progress.value = 0;
    progress.max = 100; // 初始最大值，将在音频加载后更新
    trackDiv.appendChild(progress);

    // 当音频元数据加载后，更新进度条的最大值
    audio.onloadedmetadata = function() {
        progress.max = audio.duration;
    };

    // 当音频播放时，更新进度条的值
    audio.ontimeupdate = function() {
        progress.value = audio.currentTime;
    };

    // 添加删除按钮
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.onclick = function() {
        audio.remove();
        progress.remove(); // 移除进度条
        loopCheckbox.remove(); // 移除循环选项
        loopLabel.remove(); // 移除循环标签
        volumeSlider.remove(); // 移除音量滑块
        deleteButton.remove();
    };
    trackDiv.appendChild(deleteButton);

    // 创建一个复选框元素
    const loopCheckbox = document.createElement('input');
    loopCheckbox.type = 'checkbox';
    loopCheckbox.id = 'loop';
    loopCheckbox.name = 'loop';
    loopCheckbox.onchange = function() {
        audio.loop = loopCheckbox.checked; // 设置音频循环属性
    };

    // 创建一个标签元素
    const loopLabel = document.createElement('label');
    loopLabel.htmlFor = 'loop';
    loopLabel.appendChild(document.createTextNode('Loop'));

    // 添加复选框和标签到轨道
    trackDiv.appendChild(loopCheckbox);
    trackDiv.appendChild(loopLabel);

    // 当音频元数据加载后，更新进度条的最大值和音频长度条的宽度
    audio.onloadedmetadata = function() {
        progress.max = audio.duration;

        // 创建一个新的div元素来表示音频的长度
        const audioLengthBar = document.createElement('div');
        audioLengthBar.className = 'audio-length-bar';

        // 根据音频的持续时间设置音频长度条的宽度
        const audioLength = audio.duration * 10; // 你可以根据需要调整这个乘数
        audioLengthBar.style.width = audioLength + 'px';

        // 将音频长度条添加到轨道中
        trackDiv.appendChild(audioLengthBar);
    };
}


function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
}

function addTrack() {
    const trackDiv = document.createElement('div');
    trackDiv.className = 'track';

    // Delete track button
    const deleteTrackButton = document.createElement('button');
    deleteTrackButton.textContent = 'Delete Track';
    deleteTrackButton.onclick = function() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        trackDiv.remove();
        if (currentAudioObj) {
            currentAudioObj.pause();
            currentAudioObj.currentTime = 0;
            isPaused = false;
        }
    };
    trackDiv.appendChild(deleteTrackButton);


    const playButton = document.createElement('button');
    playButton.className = 'play-button';
    playButton.onclick = function() {
        const audios = trackDiv.querySelectorAll('audio');
        audios.forEach(audio => {
            if (audio.paused) {  // 检查音频是否暂停
                audio.play();    // 如果暂停，则播放音频
            } else {
                audio.pause();   // 如果播放，则暂停音频
            }
        });
    };
    trackDiv.appendChild(playButton);

    // Pause button
    const pauseButton = document.createElement('button');
    pauseButton.className = 'pause-button';
    pauseButton.onclick = function() {
        const audios = trackDiv.querySelectorAll('audio');
        audios.forEach(audio => {
            audio.pause();
        });
    };
    trackDiv.appendChild(pauseButton);

    // Stop button
    const stopButton = document.createElement('button');
    stopButton.textContent = 'Stop';
    stopButton.onclick = function() {
        const audios = trackDiv.querySelectorAll('audio');
        audios.forEach(audio => {
            audio.pause(); // 暂停音频
            audio.currentTime = 0; // 将音频重置到开始位置
        });
    };
    trackDiv.appendChild(stopButton);

    // Add audio track button
    const addAudioButton = document.createElement('button');
    addAudioButton.textContent = 'Add Audio';
    addAudioButton.onclick = function() {
        const audioInput = document.createElement('input');
        audioInput.type = 'file';
        audioInput.accept = 'audio/*';
        audioInput.onchange = function(event) { // 添加这个事件监听器
            const file = event.target.files[0];
            if (file) {
                const audio = document.createElement('audio');
                audio.controls = true;
                audio.src = URL.createObjectURL(file); // 设置音频元素的源为用户选择的文件
    
                // 添加音频元素到轨道
                trackDiv.appendChild(audio);
    
                // ... 其他你需要的代码，比如进度条、删除按钮等
                // Delete instrument button
        const deleteInstrumentButton = document.createElement('button');
        deleteInstrumentButton.textContent = 'Delete Instrument';
        deleteInstrumentButton.onclick = function() {
            audioInput.remove();
            deleteInstrumentButton.remove();
        };
        trackDiv.appendChild(deleteInstrumentButton);
            }
        };

        audioInput.click(); // 触发文件选择对话框
    };
    trackDiv.appendChild(addAudioButton);

    // Record button
    const recordButton = document.createElement('button');
    recordButton.textContent = 'Record';
    recordButton.onclick = async function() {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        recordedChunks = [];

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(recordedChunks, {
                type: 'audio/wav'
            });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.controls = true;
            trackDiv.appendChild(audio);

            // Delete recorded audio button
            const deleteAudioButton = document.createElement('button');
            deleteAudioButton.textContent = 'Delete Recorded Audio';
            deleteAudioButton.onclick = function() {
                audio.remove();
                deleteAudioButton.remove();
            };
            trackDiv.appendChild(deleteAudioButton);
        };

        mediaRecorder.start();
        recordButton.disabled = true;
        stopRecordingButton.disabled = false;
    };
    trackDiv.appendChild(recordButton);

    // Stop recording button
    const stopRecordingButton = document.createElement('button');
    stopRecordingButton.textContent = 'Stop Recording';
    stopRecordingButton.onclick = function() {
        if (mediaRecorder) {
            mediaRecorder.stop();
            recordButton.disabled = false;
            stopRecordingButton.disabled = true;
        }
    };
    stopRecordingButton.disabled = true;
    trackDiv.appendChild(stopRecordingButton);

    // Volume control
    const volumeLabel = document.createElement('label');
volumeLabel.textContent = 'Volume: ';
trackDiv.appendChild(volumeLabel);

const volumeSlider = document.createElement('input');
volumeSlider.type = 'range';
volumeSlider.min = '0';
volumeSlider.max = '1';
volumeSlider.step = '0.01';
volumeSlider.value = '1';
volumeSlider.oninput = function() {
    const audios = trackDiv.querySelectorAll('audio'); // 获取轨道中的所有音频元素
    audios.forEach(audio => {
        adjustVolume(audio, volumeSlider.value); // 为每个音频元素调整音量
    });
};
trackDiv.appendChild(volumeSlider);

    // Enable dropping of instruments
    trackDiv.ondrop = function(event) {
        handleDrop(event, trackDiv);
    };
    trackDiv.ondragover = handleDragOver;

    document.getElementById('tracks').appendChild(trackDiv);
}

document.getElementById('downloadMix').onclick = async function() {
    const tracks = document.querySelectorAll('.track audio');
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const sources = [];
    const promises = [];

    tracks.forEach(track => {
        promises.push(new Promise(resolve => {
            const audioBuffer = audioContext.createBufferSource();
            const request = new XMLHttpRequest();
            request.open('GET', track.src, true);
            request.responseType = 'arraybuffer';
            request.onload = function() {
                audioContext.decodeAudioData(request.response, function(buffer) {
                    audioBuffer.buffer = buffer;
                    sources.push(audioBuffer);
                    resolve();
                });
            };
            request.send();
        }));
    });

    await Promise.all(promises);

    const duration = Math.max(...sources.map(source => source.buffer.duration));
    const mixedBuffer = audioContext.createBuffer(2, duration * audioContext.sampleRate, audioContext.sampleRate);
    sources.forEach(source => {
        for (let channel = 0; channel < source.buffer.numberOfChannels; channel++) {
            const mixedData = mixedBuffer.getChannelData(channel);
            const channelData = source.buffer.getChannelData(channel);
            for (let i = 0; i < channelData.length; i++) {
                mixedData[i] += channelData[i];
            }
        }
    });

    // Convert mixedBuffer to ArrayBuffer
    const mixedArrayBuffer = mixedBuffer.getChannelData(0).buffer;

    const audioBlob = new Blob([mixedArrayBuffer], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = audioUrl;
    downloadLink.download = 'mixed-audio.wav';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
};


function playAllTracks() {
    const allAudios = document.querySelectorAll('.track audio');
    allAudios.forEach(audio => {
        audio.play();
    });
}

function pauseAllTracks() {
    const allAudios = document.querySelectorAll('.track audio');
    allAudios.forEach(audio => {
        audio.pause();
    });
}

// 新增的停止所有音轨的函数
function stopAllTracks() {
    const tracks = document.querySelectorAll('.track audio');
    tracks.forEach(track => {
        track.pause();
        track.currentTime = 0;
    });
}


// 绑定按钮点击事件
document.getElementById('playAll').onclick = playAllTracks;
document.getElementById('pauseAll').onclick = pauseAllTracks;

function addAudioFromUrl() {
    const urlInput = document.getElementById('audioUrlInput');
    const audioUrl = urlInput.value.trim(); // 获取输入的音频URL

    if (audioUrl) {
        const draggableDiv = document.createElement('div');
        draggableDiv.className = 'draggable';
        draggableDiv.draggable = true;
        draggableDiv.setAttribute('data-audio-url', audioUrl);
        draggableDiv.ondragstart = handleDragStart;
        draggableDiv.textContent = 'Music' + audioCount++; // 给每个新添加的音频命名

        document.getElementById('external-audios').appendChild(draggableDiv); // 将可拖拽的按钮添加到页面中
        urlInput.value = ''; // 清空输入框
    } else {
        alert('Please enter a valid audio URL.'); // 如果输入无效，显示一个警告
    }
}
