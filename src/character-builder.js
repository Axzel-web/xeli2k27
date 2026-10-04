import * as THREE from "three";

// ----------------------------------------------------------------------------
// HIGH-FIDELITY HUMAN CHARACTER GENERATOR (Stylized Realistic Proportions ~1.82m)
// ----------------------------------------------------------------------------

export function createHumanHunterCharacter(isLocal = true, accentColor = 0x00d2ff) {
  const root = new THREE.Group();
  const limbs = {};

  // Realistic PBR-style materials for character outerwear and technical gear
  const jacketMat = new THREE.MeshStandardMaterial({
    color: 0x141a29,
    roughness: 0.65,
    metalness: 0.25
  });
  const jacketTrimMat = new THREE.MeshStandardMaterial({
    color: 0x1e273d,
    roughness: 0.5,
    metalness: 0.4
  });
  const innerShirtMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.8
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x0d121c,
    roughness: 0.7,
    metalness: 0.2
  });
  const pocketMat = new THREE.MeshStandardMaterial({
    color: 0x151d2d,
    roughness: 0.6,
    metalness: 0.3
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x1a2336,
    roughness: 0.45,
    metalness: 0.35
  });
  const soleMat = new THREE.MeshStandardMaterial({
    color: 0x080c14,
    roughness: 0.9,
    metalness: 0.1
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd4a373,
    roughness: 0.6,
    metalness: 0.05
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x0f1523,
    roughness: 0.85
  });
  const accentMat = new THREE.MeshBasicMaterial({ color: accentColor });
  const metalDetailMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.9,
    roughness: 0.2
  });

  // 1. Torso & Technical Jacket (Center ~1.28m from ground)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 1.28, 0);

  // Upper Chest / Jacket Body
  const chestGeo = new THREE.BoxGeometry(0.52, 0.48, 0.28);
  const chest = new THREE.Mesh(chestGeo, jacketMat);
  chest.castShadow = true;
  chest.receiveShadow = true;
  torsoGroup.add(chest);

  // Technical Reinforced Shoulder Epaulets
  for (let s = -1; s <= 1; s += 2) {
    const epaulet = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.26), jacketTrimMat);
    epaulet.position.set(s * 0.24, 0.24, 0);
    torsoGroup.add(epaulet);
  }

  // Stand-up Technical Collar
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.26), jacketTrimMat);
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

  // Metallic Belt Buckle
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.04), metalDetailMat);
  buckle.position.set(0, -0.28, 0.14);
  torsoGroup.add(buckle);

  // Utility Pouches on Belt (Left and Right)
  const pouchL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.08), jacketMat);
  pouchL.position.set(-0.18, -0.28, 0.12);
  torsoGroup.add(pouchL);

  const pouchR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.08), jacketMat);
  pouchR.position.set(0.18, -0.28, 0.12);
  torsoGroup.add(pouchR);

  root.add(torsoGroup);
  limbs.torso = torsoGroup;

  // 2. Neck & Head (~1.65m to 1.82m)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.38, 0);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 12), skinMat);
  neck.position.y = 0.06;
  headGroup.add(neck);

  // Head Mesh (Natural jawline proportions)
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.24), skinMat);
  headMesh.position.y = 0.24;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Hair Styling
  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.26), hairMat);
  hairMesh.position.set(0, 0.34, -0.01);
  headGroup.add(hairMesh);

  // Diagnostic Cyber Visor / Headset with Earpiece
  const headset = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.25), metalDetailMat);
  headset.position.set(0, 0.25, 0);
  headGroup.add(headset);

  // Subtle Glowing Visor Strip (XELI Diagnostic HUD)
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.04), accentMat);
  visor.position.set(0, 0.25, 0.125);
  headGroup.add(visor);

  torsoGroup.add(headGroup);
  limbs.head = headGroup;

  // 3. Left Arm (Shoulder, Upper Arm, Forearm, Hand with Fingers)
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

  // Technical Wrist Cuff
  const leftCuff = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.15), jacketTrimMat);
  leftCuff.position.y = -0.32;
  leftForearmGroup.add(leftCuff);

  // Left Hand & Thumb
  const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.09), skinMat);
  leftHand.position.set(0, -0.39, 0);
  leftForearmGroup.add(leftHand);

  const leftThumb = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 0.04), skinMat);
  leftThumb.position.set(0.04, -0.38, 0.02);
  leftForearmGroup.add(leftThumb);

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

  // Technical Wrist Cuff
  const rightCuff = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.15), jacketTrimMat);
  rightCuff.position.y = -0.32;
  rightForearmGroup.add(rightCuff);

  // Right Hand & Thumb
  const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.09), skinMat);
  rightHand.position.set(0, -0.39, 0);
  rightForearmGroup.add(rightHand);

  const rightThumb = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 0.04), skinMat);
  rightThumb.position.set(-0.04, -0.38, 0.02);
  rightForearmGroup.add(rightThumb);

  rightArmGroup.add(rightForearmGroup);
  torsoGroup.add(rightArmGroup);
  limbs.rightArm = rightArmGroup;
  limbs.rightForearm = rightForearmGroup;

  // 5. Left Leg (Hip at ~0.95m, Thigh with Cargo Pocket, Calf, Tactical Boot)
  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.16, 0.95, 0);

  const leftThigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 0.18), pantsMat);
  leftThigh.position.y = -0.24;
  leftThigh.castShadow = true;
  leftLegGroup.add(leftThigh);

  // Cargo Side Pocket on Thigh
  const leftCargo = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.14), pocketMat);
  leftCargo.position.set(-0.1, -0.22, 0);
  leftLegGroup.add(leftCargo);

  const leftCalfGroup = new THREE.Group();
  leftCalfGroup.position.set(0, -0.48, 0);

  const leftCalf = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.16), pantsMat);
  leftCalf.position.y = -0.22;
  leftCalf.castShadow = true;
  leftCalfGroup.add(leftCalf);

  // Tactical Boot Upper & Rubber Sole
  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.28), bootMat);
  leftShoe.position.set(0, -0.45, 0.05);
  leftShoe.castShadow = true;
  leftCalfGroup.add(leftShoe);

  const leftSole = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.29), soleMat);
  leftSole.position.set(0, -0.51, 0.05);
  leftCalfGroup.add(leftSole);

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

  // Cargo Side Pocket on Thigh
  const rightCargo = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.14), pocketMat);
  rightCargo.position.set(0.1, -0.22, 0);
  rightLegGroup.add(rightCargo);

  const rightCalfGroup = new THREE.Group();
  rightCalfGroup.position.set(0, -0.48, 0);

  const rightCalf = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.16), pantsMat);
  rightCalf.position.y = -0.22;
  rightCalf.castShadow = true;
  rightCalfGroup.add(rightCalf);

  // Tactical Boot Upper & Rubber Sole
  const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.28), bootMat);
  rightShoe.position.set(0, -0.45, 0.05);
  rightShoe.castShadow = true;
  rightCalfGroup.add(rightShoe);

  const rightSole = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.29), soleMat);
  rightSole.position.set(0, -0.51, 0.05);
  rightCalfGroup.add(rightSole);

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
    if (limbs.leftLeg) limbs.leftLeg.rotation.x = THREE.MathUtils.lerp(limbs.leftLeg.rotation.x, -0.45, lerpRate);
    if (limbs.rightLeg) limbs.rightLeg.rotation.x = THREE.MathUtils.lerp(limbs.rightLeg.rotation.x, 0.25, lerpRate);
    if (limbs.leftCalf) limbs.leftCalf.rotation.x = THREE.MathUtils.lerp(limbs.leftCalf.rotation.x, 0.75, lerpRate);
    if (limbs.rightCalf) limbs.rightCalf.rotation.x = THREE.MathUtils.lerp(limbs.rightCalf.rotation.x, 0.35, lerpRate);
    if (limbs.leftArm) limbs.leftArm.rotation.x = THREE.MathUtils.lerp(limbs.leftArm.rotation.x, -0.65, lerpRate);
    if (limbs.rightArm) limbs.rightArm.rotation.x = THREE.MathUtils.lerp(limbs.rightArm.rotation.x, -0.65, lerpRate);
    return;
  }

  // GROUND MOVEMENT (WALK / SPRINT)
  if (isMoving) {
    const speedMultiplier = isSprinting ? 1.6 : 1.0;
    const strideFreq = now * 0.009 * speedMultiplier;
    const legSwing = Math.sin(strideFreq) * (isSprinting ? 0.78 : 0.58);
    const armSwing = Math.sin(strideFreq) * (isSprinting ? 0.85 : 0.52);

    // Torso subtle forward lean and dynamic vertical stride bounce
    limbs.torso.position.y = 1.28 + Math.abs(Math.sin(strideFreq * 2)) * 0.05;
    limbs.torso.rotation.x = isSprinting ? 0.22 : 0.08;
    limbs.torso.rotation.y = Math.sin(strideFreq) * 0.06;

    // Legs: Alternating natural hip swings and knee flexion
    if (limbs.leftLeg) {
      limbs.leftLeg.rotation.x = legSwing;
      if (limbs.leftCalf) {
        limbs.leftCalf.rotation.x = legSwing < 0 ? Math.abs(legSwing) * 1.15 : 0.05;
      }
    }
    if (limbs.rightLeg) {
      limbs.rightLeg.rotation.x = -legSwing;
      if (limbs.rightCalf) {
        limbs.rightCalf.rotation.x = legSwing > 0 ? Math.abs(legSwing) * 1.15 : 0.05;
      }
    }

    // Arms: Counter-swinging with bent elbows
    if (limbs.leftArm) {
      limbs.leftArm.rotation.x = -armSwing;
      if (limbs.leftForearm) limbs.leftForearm.rotation.x = -0.38 + Math.abs(armSwing) * 0.32;
    }
    if (limbs.rightArm) {
      limbs.rightArm.rotation.x = armSwing;
      if (limbs.rightForearm) limbs.rightForearm.rotation.x = -0.38 + Math.abs(armSwing) * 0.32;
    }
  } else {
    // IDLE: Realistic gentle breathing & natural weight shift
    const breatheTime = now * 0.0025;
    const breathe = Math.sin(breatheTime);
    const lerpRate = 8 * delta;

    limbs.torso.position.y = THREE.MathUtils.lerp(limbs.torso.position.y, 1.28 + breathe * 0.015, lerpRate);
    limbs.torso.rotation.x = THREE.MathUtils.lerp(limbs.torso.rotation.x, 0, lerpRate);
    limbs.torso.rotation.y = THREE.MathUtils.lerp(limbs.torso.rotation.y, 0, lerpRate);

    // Subtle natural head movement
    if (limbs.head) {
      limbs.head.rotation.y = Math.sin(breatheTime * 0.5) * 0.04;
      limbs.head.rotation.x = Math.sin(breatheTime * 0.8) * 0.025;
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
