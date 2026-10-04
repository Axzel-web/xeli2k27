import * as THREE from "three";

// ----------------------------------------------------------------------------
// HUMAN CHARACTER GENERATOR (Stylized Realistic Proportions ~1.82m)
// ----------------------------------------------------------------------------

export function createHumanHunterCharacter(isLocal = true, accentColor = 0x00d2ff) {
  const root = new THREE.Group();
  const limbs = {};

  // Palette: Dark technical outerwear with graphite utility fabrics & cyan trim
  const jacketMat = new THREE.MeshStandardMaterial({
    color: 0x141a29,
    roughness: 0.65,
    metalness: 0.25
  });
  const innerShirtMat = new THREE.MeshStandardMaterial({ color: 0x0a0e17, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x0d121c,
    roughness: 0.7,
    metalness: 0.2
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x1f293d,
    roughness: 0.4,
    metalness: 0.4
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd4a373,
    roughness: 0.6,
    metalness: 0.05
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.85
  });
  const accentMat = new THREE.MeshBasicMaterial({ color: accentColor });
  const metalDetailMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85 });

  // 1. Torso & Technical Jacket (Center ~1.3m from ground)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 1.28, 0);

  // Upper Chest / Jacket
  const chestGeo = new THREE.BoxGeometry(0.52, 0.48, 0.28);
  const chest = new THREE.Mesh(chestGeo, jacketMat);
  chest.castShadow = true;
  chest.receiveShadow = true;
  torsoGroup.add(chest);

  // Technical Collar
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.26), jacketMat);
  collar.position.set(0, 0.26, -0.02);
  torsoGroup.add(collar);

  // Inner Technical Shirt Zipper Line
  const zipper = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.44), innerShirtMat);
  zipper.position.set(0, 0, 0.142);
  torsoGroup.add(zipper);

  // XELI Hunter ID Badge on Chest
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.12), accentMat);
  badge.position.set(-0.14, 0.1, 0.143);
  torsoGroup.add(badge);

  // Lower Torso / Utility Belt
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.26), innerShirtMat);
  belt.position.set(0, -0.28, 0);
  torsoGroup.add(belt);

  // Utility Pouch on Belt
  const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.08), jacketMat);
  pouch.position.set(0.18, -0.28, 0.12);
  torsoGroup.add(pouch);

  root.add(torsoGroup);
  limbs.torso = torsoGroup;

  // 2. Neck & Head (~1.65m to 1.82m)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.38, 0);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 12), skinMat);
  neck.position.y = 0.06;
  headGroup.add(neck);

  // Head Mesh
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.24), skinMat);
  headMesh.position.y = 0.24;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Stylized Hair
  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.26), hairMat);
  hairMesh.position.set(0, 0.34, -0.01);
  headGroup.add(hairMesh);

  // Diagnostic Cyber Visor / Headset with Earpiece
  const headset = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.25), metalDetailMat);
  headset.position.set(0, 0.25, 0);
  headGroup.add(headset);

  // Glowing Visor Strip
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.04), accentMat);
  visor.position.set(0, 0.25, 0.125);
  headGroup.add(visor);

  torsoGroup.add(headGroup);
  limbs.head = headGroup;

  // 3. Left Arm (Shoulder, Upper Arm, Forearm, Hand)
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.34, 0.2, 0);

  const leftUpper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.16), jacketMat);
  leftUpper.position.y = -0.19;
  leftUpper.castShadow = true;
  leftArmGroup.add(leftUpper);

  const leftForearmGroup = new THREE.Group();
  leftForearmGroup.position.set(0, -0.38, 0);

  const leftFore = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.14), jacketMat);
  leftFore.position.y = -0.17;
  leftFore.castShadow = true;
  leftForearmGroup.add(leftFore);

  const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.1), skinMat);
  leftHand.position.y = -0.38;
  leftForearmGroup.add(leftHand);

  leftArmGroup.add(leftForearmGroup);
  torsoGroup.add(leftArmGroup);
  limbs.leftArm = leftArmGroup;
  limbs.leftForearm = leftForearmGroup;

  // 4. Right Arm (Mirror)
  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.34, 0.2, 0);

  const rightUpper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.16), jacketMat);
  rightUpper.position.y = -0.19;
  rightUpper.castShadow = true;
  rightArmGroup.add(rightUpper);

  const rightForearmGroup = new THREE.Group();
  rightForearmGroup.position.set(0, -0.38, 0);

  const rightFore = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.14), jacketMat);
  rightFore.position.y = -0.17;
  rightFore.castShadow = true;
  rightForearmGroup.add(rightFore);

  const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.1), skinMat);
  rightHand.position.y = -0.38;
  rightForearmGroup.add(rightHand);

  rightArmGroup.add(rightForearmGroup);
  torsoGroup.add(rightArmGroup);
  limbs.rightArm = rightArmGroup;
  limbs.rightForearm = rightForearmGroup;

  // 5. Left Leg (Hip at ~0.95m, Thigh, Calf, Sneaker)
  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.16, 0.95, 0);

  const leftThigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 0.18), pantsMat);
  leftThigh.position.y = -0.24;
  leftThigh.castShadow = true;
  leftLegGroup.add(leftThigh);

  const leftCalfGroup = new THREE.Group();
  leftCalfGroup.position.set(0, -0.48, 0);

  const leftCalf = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.16), pantsMat);
  leftCalf.position.y = -0.22;
  leftCalf.castShadow = true;
  leftCalfGroup.add(leftCalf);

  // Tactical Sneaker
  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.28), bootMat);
  leftShoe.position.set(0, -0.46, 0.05);
  leftShoe.castShadow = true;
  leftCalfGroup.add(leftShoe);

  leftLegGroup.add(leftCalfGroup);
  root.add(leftLegGroup);
  limbs.leftLeg = leftLegGroup;
  limbs.leftCalf = leftCalfGroup;

  // 6. Right Leg (Mirror)
  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.16, 0.95, 0);

  const rightThigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 0.18), pantsMat);
  rightThigh.position.y = -0.24;
  rightThigh.castShadow = true;
  rightLegGroup.add(rightThigh);

  const rightCalfGroup = new THREE.Group();
  rightCalfGroup.position.set(0, -0.48, 0);

  const rightCalf = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.16), pantsMat);
  rightCalf.position.y = -0.22;
  rightCalf.castShadow = true;
  rightCalfGroup.add(rightCalf);

  // Tactical Sneaker
  const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.28), bootMat);
  rightShoe.position.set(0, -0.46, 0.05);
  rightShoe.castShadow = true;
  rightCalfGroup.add(rightShoe);

  rightLegGroup.add(rightCalfGroup);
  root.add(rightLegGroup);
  limbs.rightLeg = rightLegGroup;
  limbs.rightCalf = rightCalfGroup;

  return { root, limbs };
}

// ----------------------------------------------------------------------------
// PROCEDURAL HUMAN LOCOMOTION & IDLE ANIMATION CONTROLLER
// ----------------------------------------------------------------------------

export function animateHumanCharacter(limbs, isMoving, isSprinting, isGrounded, delta) {
  if (!limbs || !limbs.torso) return;

  const now = performance.now();

  // JUMPING / AIRBORNE
  if (!isGrounded) {
    const lerpRate = 12 * delta;
    // Tuck legs up slightly
    if (limbs.leftLeg) limbs.leftLeg.rotation.x = THREE.MathUtils.lerp(limbs.leftLeg.rotation.x, -0.45, lerpRate);
    if (limbs.rightLeg) limbs.rightLeg.rotation.x = THREE.MathUtils.lerp(limbs.rightLeg.rotation.x, 0.25, lerpRate);
    if (limbs.leftCalf) limbs.leftCalf.rotation.x = THREE.MathUtils.lerp(limbs.leftCalf.rotation.x, 0.7, lerpRate);
    if (limbs.rightCalf) limbs.rightCalf.rotation.x = THREE.MathUtils.lerp(limbs.rightCalf.rotation.x, 0.3, lerpRate);
    // Arms raise slightly for balance
    if (limbs.leftArm) limbs.leftArm.rotation.x = THREE.MathUtils.lerp(limbs.leftArm.rotation.x, -0.6, lerpRate);
    if (limbs.rightArm) limbs.rightArm.rotation.x = THREE.MathUtils.lerp(limbs.rightArm.rotation.x, -0.6, lerpRate);
    return;
  }

  // GROUND MOVEMENT (WALK / SPRINT)
  if (isMoving) {
    const speedMultiplier = isSprinting ? 1.55 : 1.0;
    const strideFreq = now * 0.009 * speedMultiplier;
    const legSwing = Math.sin(strideFreq) * (isSprinting ? 0.75 : 0.55);
    const armSwing = Math.sin(strideFreq) * (isSprinting ? 0.8 : 0.5);

    // Torso subtle forward lean and dynamic bob
    limbs.torso.position.y = 1.28 + Math.abs(Math.sin(strideFreq * 2)) * 0.05;
    limbs.torso.rotation.x = isSprinting ? 0.22 : 0.08;
    limbs.torso.rotation.y = Math.sin(strideFreq) * 0.06;

    // Legs: Alternating natural hip swings
    if (limbs.leftLeg) {
      limbs.leftLeg.rotation.x = legSwing;
      if (limbs.leftCalf) {
        // Bend knee back on the backward swing
        limbs.leftCalf.rotation.x = legSwing < 0 ? Math.abs(legSwing) * 1.1 : 0.05;
      }
    }
    if (limbs.rightLeg) {
      limbs.rightLeg.rotation.x = -legSwing;
      if (limbs.rightCalf) {
        limbs.rightCalf.rotation.x = legSwing > 0 ? Math.abs(legSwing) * 1.1 : 0.05;
      }
    }

    // Arms: Counter-swinging with bent elbows
    if (limbs.leftArm) {
      limbs.leftArm.rotation.x = -armSwing;
      if (limbs.leftForearm) limbs.leftForearm.rotation.x = -0.35 + Math.abs(armSwing) * 0.3;
    }
    if (limbs.rightArm) {
      limbs.rightArm.rotation.x = armSwing;
      if (limbs.rightForearm) limbs.rightForearm.rotation.x = -0.35 + Math.abs(armSwing) * 0.3;
    }
  } else {
    // IDLE: Realistic gentle breathing & relaxed natural stance
    const breatheTime = now * 0.0025;
    const breathe = Math.sin(breatheTime);
    const lerpRate = 8 * delta;

    limbs.torso.position.y = THREE.MathUtils.lerp(limbs.torso.position.y, 1.28 + breathe * 0.015, lerpRate);
    limbs.torso.rotation.x = THREE.MathUtils.lerp(limbs.torso.rotation.x, 0, lerpRate);
    limbs.torso.rotation.y = THREE.MathUtils.lerp(limbs.torso.rotation.y, 0, lerpRate);

    // Head micro-movement
    if (limbs.head) {
      limbs.head.rotation.y = Math.sin(breatheTime * 0.5) * 0.05;
      limbs.head.rotation.x = Math.sin(breatheTime * 0.8) * 0.03;
    }

    // Relaxed arms at sides
    if (limbs.leftArm) {
      limbs.leftArm.rotation.x = THREE.MathUtils.lerp(limbs.leftArm.rotation.x, 0.05, lerpRate);
      limbs.leftArm.rotation.z = THREE.MathUtils.lerp(limbs.leftArm.rotation.z, 0.08, lerpRate);
      if (limbs.leftForearm) limbs.leftForearm.rotation.x = THREE.MathUtils.lerp(limbs.leftForearm.rotation.x, -0.15, lerpRate);
    }
    if (limbs.rightArm) {
      limbs.rightArm.rotation.x = THREE.MathUtils.lerp(limbs.rightArm.rotation.x, 0.05, lerpRate);
      limbs.rightArm.rotation.z = THREE.MathUtils.lerp(limbs.rightArm.rotation.z, -0.08, lerpRate);
      if (limbs.rightForearm) limbs.rightForearm.rotation.x = THREE.MathUtils.lerp(limbs.rightForearm.rotation.x, -0.15, lerpRate);
    }

    // Straight legs
    if (limbs.leftLeg) {
      limbs.leftLeg.rotation.x = THREE.MathUtils.lerp(limbs.leftLeg.rotation.x, 0, lerpRate);
      if (limbs.leftCalf) limbs.leftCalf.rotation.x = THREE.MathUtils.lerp(limbs.leftCalf.rotation.x, 0, lerpRate);
    }
    if (limbs.rightLeg) {
      limbs.rightLeg.rotation.x = THREE.MathUtils.lerp(limbs.rightLeg.rotation.x, 0, lerpRate);
      if (limbs.rightCalf) limbs.rightCalf.rotation.x = THREE.MathUtils.lerp(limbs.rightCalf.rotation.x, 0, lerpRate);
    }
  }
}

// ----------------------------------------------------------------------------
// PROJECTED TACTICAL FLOATING NAMEPLATES
// ----------------------------------------------------------------------------

export function updateProjectedNameplates(camera, containerW, containerH, remotePlayers, botAgents) {
  const container = document.getElementById("live3dNameplates");
  if (!container || !camera) return;

  const targets = [];
  remotePlayers.forEach((p, id) => {
    if (p.group) {
      targets.push({ id, name: p.name, level: p.level, rank: p.rank, pos: p.group.position, isBot: false });
    }
  });

  botAgents.forEach((b, idx) => {
    if (b.group) {
      targets.push({ id: `bot_${idx}`, name: b.name, level: b.level, rank: b.rank, pos: b.group.position, isBot: true });
    }
  });

  const tempVec = new THREE.Vector3();

  // Synchronize DOM elements
  targets.forEach((t) => {
    let plate = document.getElementById(`np_${t.id}`);
    if (!plate) {
      plate = document.createElement("div");
      plate.id = `np_${t.id}`;
      plate.className = "live3d-nameplate";
      plate.innerHTML = `
        <div class="live3d-np-box">
          <span class="live3d-np-rank">${t.rank || "E"}</span>
          <span class="live3d-np-name">${t.name}</span>
          <span class="live3d-np-level">Lv.${t.level || 1}</span>
        </div>
      `;
      container.appendChild(plate);
    }

    tempVec.set(t.pos.x, t.pos.y + 2.1, t.pos.z);
    tempVec.project(camera);

    // Behind camera check
    if (tempVec.z > 1.0) {
      plate.style.display = "none";
      return;
    }

    const x = (tempVec.x * 0.5 + 0.5) * containerW;
    const y = (-tempVec.y * 0.5 + 0.5) * containerH;

    plate.style.display = "flex";
    plate.style.left = `${Math.round(x)}px`;
    plate.style.top = `${Math.round(y)}px`;
  });
}
