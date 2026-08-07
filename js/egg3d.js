/*
 * ============================================================
 *  彩蛋 · 3D 亚克力相册
 *  ----------------------------------------------------------
 *  按 gsap-acrylic-polaroid/album3d.js 原样移植：
 *    - 通透亚克力边框（transmission 材质） + 前玻璃 + 背面磨砂膜
 *    - 前面照片清晰；背面 = 镜像 + Canvas 模糊 图层（朝向背面）
 *    - 仅鼠标/手指拖拽旋转（无自动旋转），X 轴限位，阻尼平滑
 *  必要修正：
 *    - renderer.setClearColor(0x000000, 0) 透明清屏（背面不透黑）
 *    - 进入时 albumGroup 旋转为 0（正面朝向）
 *    - 相册宽高按图片比例自适应（横图不变形）
 *  ============================================================
 */
(function () {
  'use strict';

  var scene, camera, renderer;
  var albumGroup, photoGroup;
  var canvas = null;
  var isActive = false;
  var animationId = null;
  var isReady = false;

  /* 相框四边：磨砂半透明玻璃（不用 transmission——透明画布下透射会渲成黑色） */
  function createClearAcrylic() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.18,
      transmission: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      envMapIntensity: 1.2
    });
  }

  function createFrostedAcrylic() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.8,
      transmission: 0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.35,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 1
    });
  }

  function createAlbumFrame(width, height) {
    var depth = 0.35;
    var thickness = 0.12;
    var group = new THREE.Group();
    var clear = createClearAcrylic();

    var top = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), clear);
    top.position.y = height / 2 - thickness / 2;
    group.add(top);

    var bottom = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), clear);
    bottom.position.y = -height / 2 + thickness / 2;
    group.add(bottom);

    var left = new THREE.Mesh(new THREE.BoxGeometry(thickness, height - thickness * 2, depth), clear);
    left.position.x = -width / 2 + thickness / 2;
    group.add(left);

    var right = new THREE.Mesh(new THREE.BoxGeometry(thickness, height - thickness * 2, depth), clear);
    right.position.x = width / 2 - thickness / 2;
    group.add(right);

    var frontGlass = new THREE.Mesh(
      new THREE.BoxGeometry(width - thickness * 2, height - thickness * 2, 0.015),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff, metalness: 0, roughness: 0.04, transmission: 0,
        clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: 0.08,
        depthWrite: false, side: THREE.DoubleSide
      })
    );
    frontGlass.position.z = 0.08;
    group.add(frontGlass);

    var frosted = createFrostedAcrylic();
    var backFilm = new THREE.Mesh(
      new THREE.PlaneGeometry(width - thickness * 2, height - thickness * 2),
      frosted
    );
    backFilm.rotation.y = Math.PI;
    backFilm.position.z = -0.08;
    backFilm.renderOrder = 10;
    group.add(backFilm);

    var spine = new THREE.Mesh(new THREE.BoxGeometry(0.08, height, depth), frosted);
    spine.position.x = width / 2 + 0.04;
    group.add(spine);

    return group;
  }

  /* 背面贴图：仅模糊（不预镜像）。
     背面平面已 rotateY(PI)，本身就会让贴图左右翻转，
     因此从背面看到的正是"镜像"的照片，像真实照片的背面。 */
  function createBlurTexture(image) {
    var width = image.naturalWidth || image.videoWidth || image.width;
    var height = image.naturalHeight || image.videoHeight || image.height;
    var c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    var context = c.getContext('2d');
    context.filter = 'blur(12px)';
    context.drawImage(image, 0, 0, width, height);

    var texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  function createPhotoPlanes(photoUrl, width, height) {
    var group = new THREE.Group();
    var thickness = 0.12;
    var innerW = width - thickness * 2;
    var innerH = height - thickness * 2;
    var photoWidth = innerW - 0.04;
    var photoHeight = innerH - 0.04;

    var loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    loader.load(
      photoUrl,
      function (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        var mainPhoto = new THREE.Mesh(
          new THREE.PlaneGeometry(photoWidth, photoHeight),
          new THREE.MeshBasicMaterial({ map: texture })
        );
        mainPhoto.position.z = 0.018;
        group.add(mainPhoto);

        var matBoard = new THREE.Mesh(
          new THREE.PlaneGeometry(photoWidth + 0.08, photoHeight + 0.08),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide })
        );
        matBoard.position.z = -0.005;
        group.add(matBoard);

        var backPhoto = new THREE.Mesh(
          new THREE.PlaneGeometry(photoWidth, photoHeight),
          new THREE.MeshBasicMaterial({
            map: createBlurTexture(texture.image),
            transparent: true,
            opacity: 0.9,
            depthWrite: false
          })
        );
        backPhoto.rotation.y = Math.PI;
        backPhoto.position.z = -0.012;
        backPhoto.renderOrder = 5;
        group.add(backPhoto);
      },
      undefined,
      function (err) { console.error('Texture load failed:', err); }
    );

    return group;
  }

  /* 简易环境贴图（PMREM）：给亚克力材质提供反射，避免倾斜时 transmission 渲成黑色 */
  function buildEnvironment(r) {
    var pmrem = new THREE.PMREMGenerator(r);
    var es = new THREE.Scene();
    es.background = new THREE.Color(0x10131c);
    function glow(x, y, z, w, h, color) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: color }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      es.add(m);
    }
    glow(5, 3, 5, 9, 4, 0xe8c68a);   /* 金色 */
    glow(-4, -2, 4, 8, 3, 0x667eea); /* 冷蓝 */
    var tex = pmrem.fromScene(es, 0.05).texture;
    pmrem.dispose();
    return tex;
  }

  function onResize() {
    var container = document.getElementById('eggCanvasWrap');
    if (!container || !camera || !renderer) return;
    var w = container.clientWidth;
    var h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  var isDragging = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var albumStartRotX = 0;
  var albumStartRotY = 0;
  var targetRotX = 0;
  var targetRotY = 0;
  var MIN_ROT_X = -0.5;
  var MAX_ROT_X = 0.5;

  function clampRotation() {
    targetRotX = Math.max(MIN_ROT_X, Math.min(MAX_ROT_X, targetRotX));
  }

  function bindDragRotation() {
    if (!canvas || !albumGroup) return;

    canvas.addEventListener('mousedown', function (e) {
      if (!isActive || !isReady) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      albumStartRotX = albumGroup.rotation.x;
      albumStartRotY = albumGroup.rotation.y;
      canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      var dx = e.clientX - dragStartX;
      var dy = e.clientY - dragStartY;
      targetRotY = albumStartRotY + dx * 0.008;
      targetRotX = albumStartRotX + dy * 0.008;
      clampRotation();
    });

    window.addEventListener('mouseup', function () {
      isDragging = false;
      canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('touchstart', function (e) {
      if (!isActive || !isReady) return;
      isDragging = true;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      albumStartRotX = albumGroup.rotation.x;
      albumStartRotY = albumGroup.rotation.y;
    }, { passive: true });

    window.addEventListener('touchmove', function (e) {
      if (!isDragging) return;
      var dx = e.touches[0].clientX - dragStartX;
      var dy = e.touches[0].clientY - dragStartY;
      targetRotY = albumStartRotY + dx * 0.008;
      targetRotX = albumStartRotX + dy * 0.008;
      clampRotation();
    }, { passive: true });

    window.addEventListener('touchend', function () {
      isDragging = false;
    });

    var animate = function () {
      animationId = requestAnimationFrame(animate);
      if (!isReady || !isActive) return;
      clampRotation();
      albumGroup.rotation.x += (targetRotX - albumGroup.rotation.x) * 0.1;
      albumGroup.rotation.y += (targetRotY - albumGroup.rotation.y) * 0.1;
      if (renderer && scene && camera) renderer.render(scene, camera);
    };
    animationId = requestAnimationFrame(animate);
  }

  function init(containerId, photoUrl) {
    var container = document.getElementById(containerId);
    if (!container || !window.THREE) return;
    var w = container.clientWidth || 300;
    var h = container.clientHeight || 400;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0, 9);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);   /* 透明清屏：背面不透黑 */
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    canvas = renderer.domElement;
    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'none';

    /* 亚克力反射环境贴图（必须在 renderer 创建后；失败不影响主体） */
    try { scene.environment = buildEnvironment(renderer); } catch (e) {}

    var ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    var dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 5, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    var backLight = new THREE.PointLight(0x667eea, 1, 20);
    backLight.position.set(-3, 2, -4);
    scene.add(backLight);

    /* 原源码的粉色轮廓光已移除：四边亚克力颜色统一 */

    /* 先取图片尺寸 → 相册按比例自适应，再建相册（图片缓存后 TextureLoader 再加载一次） */
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        var aspect = (img.naturalWidth || 1) / (img.naturalHeight || 1);
        var width = 4.2 * aspect;
        width = Math.max(2.2, Math.min(5.6, width));
        var height = 4.2;

        albumGroup = new THREE.Group();
        scene.add(albumGroup);
        albumGroup.add(createAlbumFrame(width, height));
        albumGroup.add(createPhotoPlanes(photoUrl, width, height));
        albumGroup.rotation.y = 0;   /* 进入时正面朝向 */
        albumGroup.rotation.x = 0;
        isReady = true;
        window.Egg3D.ready = true;
        bindDragRotation();
      } catch (err) { console.error('egg album build failed:', err); }
    };
    img.src = photoUrl;

    window.addEventListener('resize', onResize);
  }

  function setActive(active) {
    isActive = active;
    if (canvas) canvas.style.cursor = active ? 'grab' : 'default';
    if (!active) return;
    onResize();
  }

  function destroy() {
    if (animationId) cancelAnimationFrame(animationId);
    window.removeEventListener('resize', onResize);
    if (renderer) {
      renderer.dispose();
      var c = document.getElementById('eggCanvasWrap');
      if (c && renderer.domElement && c.contains(renderer.domElement)) {
        c.removeChild(renderer.domElement);
      }
    }
    renderer = null; canvas = null; scene = null; camera = null; albumGroup = null;
    isReady = false; isActive = false;
  }

  window.Egg3D = { init: init, setActive: setActive, destroy: destroy, ready: false };
})();
