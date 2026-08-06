/*
 * ============================================================
 *  彩蛋 · 3D 亚克力相册（移植自 gsap-acrylic-polaroid/album3d.js）
 *  ----------------------------------------------------------
 *  前面照片清晰、背面镜像+模糊；通透亚克力边框；
 *  仅拖拽旋转（鼠标/手指），无自动旋转；按图片比例自适应。
 *  ============================================================
 */
(function () {
  'use strict';

  var scene, camera, renderer, albumGroup;
  var canvas = null;
  var isActive = false;
  var animId = null;
  var isReady = false;

  function createClearAcrylic() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.08,
      transmission: 0.95,
      thickness: 0.3,
      ior: 1.5,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      envMapIntensity: 1
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
      opacity: 0.2,
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

    /* 前玻璃：轻微透明高光 */
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

    /* 背面磨砂膜 */
    var frosted = createFrostedAcrylic();
    var backFilm = new THREE.Mesh(
      new THREE.PlaneGeometry(width - thickness * 2, height - thickness * 2),
      frosted
    );
    backFilm.rotation.y = Math.PI;
    backFilm.position.z = -0.08;
    backFilm.renderOrder = 10;
    group.add(backFilm);

    /* 书脊 */
    var spine = new THREE.Mesh(new THREE.BoxGeometry(0.08, height, depth), frosted);
    spine.position.x = width / 2 + 0.04;
    group.add(spine);

    return group;
  }

  function createMirroredBlurTexture(img) {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.filter = 'blur(12px)';
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  function createPhotoPlanes(width, height, img) {
    var group = new THREE.Group();
    var thickness = 0.12;
    var innerW = width - thickness * 2;
    var innerH = height - thickness * 2;
    var photoW = innerW - 0.04;
    var photoH = innerH - 0.04;

    var tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    var mainPhoto = new THREE.Mesh(
      new THREE.PlaneGeometry(photoW, photoH),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    mainPhoto.position.z = 0.018;
    group.add(mainPhoto);

    /* 白色衬纸/边框 */
    var matBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(photoW + 0.08, photoH + 0.08),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide })
    );
    matBoard.position.z = -0.005;
    group.add(matBoard);

    /* 背面：镜像 + 模糊，朝向背面 */
    var backPhoto = new THREE.Mesh(
      new THREE.PlaneGeometry(photoW, photoH),
      new THREE.MeshBasicMaterial({
        map: createMirroredBlurTexture(img),
        transparent: true,
        opacity: 0.9,
        depthWrite: false
      })
    );
    backPhoto.rotation.y = Math.PI;
    backPhoto.position.z = -0.012;
    backPhoto.renderOrder = 5;
    group.add(backPhoto);

    return group;
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

  function bindDragRotation() {
    if (!canvas || !albumGroup) return;
    var isDragging = false, sx = 0, sy = 0, srX = 0, srY = 0;
    var targetRX = 0, targetRY = 0, curRX = 0, curRY = 0;

    canvas.addEventListener('mousedown', function (e) {
      if (!isActive || !isReady) return;
      isDragging = true;
      sx = e.clientX; sy = e.clientY;
      srX = targetRX; srY = targetRY;
      canvas.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      targetRY = srY + dx * 0.008;
      targetRX = Math.max(-0.5, Math.min(0.5, srX + dy * 0.008));
    });
    function endDrag() { isDragging = false; canvas.style.cursor = 'grab'; }
    window.addEventListener('mouseup', endDrag);

    canvas.addEventListener('touchstart', function (e) {
      if (!isActive || !isReady) return;
      isDragging = true;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      srX = targetRX; srY = targetRY;
    }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (!isDragging) return;
      var dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
      targetRY = srY + dx * 0.008;
      targetRX = Math.max(-0.5, Math.min(0.5, srX + dy * 0.008));
    }, { passive: true });
    window.addEventListener('touchend', endDrag);

    /* 动画循环：阻尼趋近目标（不自动旋转） */
    var animate = function () {
      animId = requestAnimationFrame(animate);
      if (!isReady || !isActive) return;
      curRX += (targetRX - curRX) * 0.1;
      curRY += (targetRY - curRY) * 0.1;
      albumGroup.rotation.x = curRX;
      albumGroup.rotation.y = curRY;
      renderer.render(scene, camera);
    };
    animId = requestAnimationFrame(animate);
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
    renderer.setClearColor(0x000000, 0);   /* 透明清屏：背面不再发黑，透出站点背景 */
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    canvas = renderer.domElement;
    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'none';

    var ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    var dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(5, 5, 8);
    scene.add(dir);
    var back = new THREE.PointLight(0x667eea, 1, 20);
    back.position.set(-3, 2, -4);
    scene.add(back);
    var rim = new THREE.PointLight(0xf093fb, 0.8, 20);
    rim.position.set(3, -2, 4);
    scene.add(rim);

    /* 等图片加载后按比例建相册 */
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      var aspect = (img.naturalWidth || 1) / (img.naturalHeight || 1);
      var width = 4.2 * aspect;
      width = Math.max(2.2, Math.min(5.6, width));
      var height = 4.2;

      albumGroup = new THREE.Group();
      scene.add(albumGroup);
      albumGroup.add(createAlbumFrame(width, height));
      albumGroup.add(createPhotoPlanes(width, height, img));
      albumGroup.rotation.y = 0;   /* 进入时正面朝向 */
      albumGroup.rotation.x = 0;
      isReady = true;
      bindDragRotation();
    };
    img.src = photoUrl;

    window.addEventListener('resize', onResize);
  }

  function setActive(active) {
    isActive = active;
    if (canvas) canvas.style.cursor = active ? 'grab' : 'default';
    if (!active) return;
    onResize();
    if (!isReady) return;
  }

  function destroy() {
    if (animId) cancelAnimationFrame(animId);
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

  window.Egg3D = { init: init, setActive: setActive, destroy: destroy };
})();
