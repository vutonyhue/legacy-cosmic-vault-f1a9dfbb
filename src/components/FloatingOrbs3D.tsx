import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

const Orb = ({ position }: { position: [number, number, number] }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const speed = Math.random() * 0.5 + 0.5;
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.getElapsedTime() * speed) * 0.5;
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <Sphere ref={meshRef} args={[0.3, 32, 32]} position={position}>
      <meshStandardMaterial
        color="#10b981"
        emissive="#10b981"
        emissiveIntensity={0.5}
        transparent
        opacity={0.6}
        roughness={0.2}
        metalness={0.8}
      />
    </Sphere>
  );
};

export const FloatingOrbs3D = () => {
  const positions: [number, number, number][] = [
    [-4, 2, -3],
    [4, -1, -4],
    [-3, -2, -2],
    [3, 3, -5],
    [0, 1, -3],
  ];

  return (
    <>
      {positions.map((pos, i) => (
        <Orb key={i} position={pos} />
      ))}
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#10b981" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#84cc16" />
    </>
  );
};
