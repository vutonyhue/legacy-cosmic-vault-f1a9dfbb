import { Canvas } from '@react-three/fiber';
import { GreenParticles3D } from './GreenParticles3D';
import { FloatingOrbs3D } from './FloatingOrbs3D';

export const Feed3DBackground = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <GreenParticles3D />
        <FloatingOrbs3D />
      </Canvas>
    </div>
  );
};
