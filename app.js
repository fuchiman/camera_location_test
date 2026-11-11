
const camera = document.getElementById("camera");
const preview = document.getElementById("preview");
const canvas = document.getElementById("canvas");

const startCameraButton = document.getElementById("startCamera");
const takePhotoButton = document.getElementById("takePhoto");
const retakeButton = document.getElementById("retake");
const cameraSelect = document.getElementById("cameraSelect");

const getLocationButton = document.getElementById("getLocation");
const submitButton = document.getElementById("submit");

const cameraStatus = document.getElementById("cameraStatus");
const locationStatus = document.getElementById("locationStatus");

let stream = null;
let photoBlob = null;
let photoUrl = null;
let position = null;
let cameras = [];

// -------------------------
// カメラ一覧の取得
// -------------------------

async function loadCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();

    cameras = devices.filter(
      device => device.kind === "videoinput"
    );

    cameraSelect.innerHTML = "";

    cameras.forEach((device, index) => {
      const option = document.createElement("option");

      option.value = device.deviceId;
      option.textContent =
        device.label || `カメラ ${index + 1}`;

      cameraSelect.appendChild(option);
    });

    cameraSelect.disabled = cameras.length <= 1;

    cameraStatus.textContent =
      `認識されたカメラ：${cameras.length}台`;

  } catch (error) {
    cameraStatus.textContent =
      "カメラ一覧を取得できませんでした：" + error.message;
  }
}

// -------------------------
// カメラ起動
// -------------------------

async function startCamera(deviceId = null) {
  stopCamera();

  try {
    const videoConstraints = deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: { ideal: "environment" } };

    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        ...videoConstraints,
        width: { ideal: 1280 },
        height: { ideal: 960 }
      }
    });

    camera.srcObject = stream;

    await camera.play();

    camera.style.display = "block";
    preview.style.display = "none";

    takePhotoButton.disabled = false;
    startCameraButton.disabled = true;

    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();

    cameraStatus.textContent =
      `使用中：${track.label || "カメラ"} / ` +
      `${settings.width || "?"}×${settings.height || "?"}`;

    // 許可取得後にカメラ一覧を更新
    await loadCameras();

    // 現在使用しているカメラを選択状態にする
    if (settings.deviceId) {
      cameraSelect.value = settings.deviceId;
    }

  } catch (error) {
    cameraStatus.textContent =
      "カメラ起動失敗：" + error.name + " / " + error.message;

    alert("カメラを起動できませんでした。\n" + error.message);

    startCameraButton.disabled = false;
  }
}

// -------------------------
// カメラ停止
// -------------------------

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  camera.srcObject = null;
}

// -------------------------
// カメラ起動ボタン
// -------------------------

startCameraButton.addEventListener("click", async () => {
  await startCamera();
});

// -------------------------
// カメラ切り替え
// -------------------------

cameraSelect.addEventListener("change", async () => {
  if (cameraSelect.value) {
    await startCamera(cameraSelect.value);
  }
});

// -------------------------
// 撮影
// -------------------------

takePhotoButton.addEventListener("click", () => {
  const width = camera.videoWidth;
  const height = camera.videoHeight;

  if (!width || !height) {
    alert("カメラの準備ができていません。");
    return;
  }

  const scale = Math.min(1, 1600 / width);

  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const context = canvas.getContext("2d");

  context.drawImage(
    camera,
    0,
    0,
    canvas.width,
    canvas.height
  );

  canvas.toBlob(blob => {
    if (!blob) {
      alert("写真の保存に失敗しました。");
      return;
    }

    photoBlob = blob;

    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
    }

    photoUrl = URL.createObjectURL(photoBlob);
    preview.src = photoUrl;

    camera.style.display = "none";
    preview.style.display = "block";

    stopCamera();

    takePhotoButton.disabled = true;
    retakeButton.hidden = false;

    startCameraButton.disabled = false;
    cameraSelect.disabled = false;

    cameraStatus.textContent = "撮影しました。";

    checkReady();
  }, "image/jpeg", 0.82);
});

// -------------------------
// 撮り直し
// -------------------------

retakeButton.addEventListener("click", async () => {
  photoBlob = null;

  preview.style.display = "none";
  retakeButton.hidden = true;

  takePhotoButton.disabled = true;
  startCameraButton.disabled = false;

  checkReady();

  // 前回使っていたカメラを再起動
  if (cameraSelect.value) {
    await startCamera(cameraSelect.value);
  } else {
    await startCamera();
  }
});

// -------------------------
// 位置情報取得
// -------------------------

getLocationButton.addEventListener("click", async () => {
  if (!navigator.geolocation) {
    locationStatus.textContent =
      "このブラウザは位置情報APIに対応していません。";
    return;
  }

  getLocationButton.disabled = true;
  locationStatus.textContent =
    "位置情報を取得しています...";

  document.getElementById("locationInfo").hidden = true;

  // 権限状態の確認（対応していないブラウザもある）
  try {
    if (navigator.permissions) {
      const permission = await navigator.permissions.query({
        name: "geolocation"
      });

      console.log("位置情報の権限:", permission.state);
    }
  } catch (error) {
    console.log("権限状態の確認には対応していません。");
  }

  navigator.geolocation.getCurrentPosition(
    result => {
      position = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracy: result.coords.accuracy,
        timestamp: result.timestamp
      };

      document.getElementById("latitude").textContent =
        position.latitude.toFixed(7);

      document.getElementById("longitude").textContent =
        position.longitude.toFixed(7);

      document.getElementById("accuracy").textContent =
        Math.round(position.accuracy);

      document.getElementById("locationTime").textContent =
        new Date(position.timestamp).toLocaleString("ja-JP");

      document.getElementById("locationInfo").hidden = false;

      locationStatus.textContent =
        position.accuracy <= 30
          ? "取得成功：精度は良好です。"
          : position.accuracy <= 100
          ? "取得成功：精度はやや低めです。"
          : "取得成功：精度が低いので再取得をおすすめします。";

      console.log("取得した位置情報:", position);

      getLocationButton.disabled = false;
      checkReady();
    },

    error => {
      const errorMessages = {
        1: "利用が拒否されました。ブラウザの位置情報許可を確認してください。",
        2: "位置情報を取得できません。端末の位置情報設定を確認してください。",
        3: "タイムアウトしました。電波のよい場所で再試行してください。"
      };

      position = null;

      locationStatus.textContent =
        `取得失敗（エラーコード ${error.code}）：` +
        (errorMessages[error.code] || error.message);

      console.error("位置情報エラー:", error);

      getLocationButton.disabled = false;
      checkReady();
    },

    {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0
    }
  );
});

// -------------------------
// 投稿可能か確認
// -------------------------

function checkReady() {
  submitButton.disabled = !(photoBlob && position);
}

// -------------------------
// 仮の投稿処理
// -------------------------

submitButton.addEventListener("click", () => {
  if (!photoBlob || !position) return;

  document.getElementById("submitStatus").textContent =
    "写真と位置情報を取得できています。Firebase接続はまだです。";

  console.log({
    photoBlob,
    position
  });
});

// -------------------------
// ページを離れるとき
// -------------------------

window.addEventListener("beforeunload", () => {
  stopCamera();

  if (photoUrl) {
    URL.revokeObjectURL(photoUrl);
  }
});
