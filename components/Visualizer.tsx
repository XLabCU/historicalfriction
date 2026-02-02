
import React, { useEffect, useRef } from 'react';
import { WikipediaArticle, SonificationMode } from '../types';

interface Props {
  articles: WikipediaArticle[];
  radius: number;
  mode: SonificationMode;
  heading: number;
}

const Visualizer: React.FC<Props> = ({ articles, radius, mode, heading }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    let time = 0;

    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxVisualRadius = Math.min(centerX, centerY) - 30;

      // Draw Compass labels - Using Space Mono for technical feel
      ctx.fillStyle = 'rgba(139, 92, 246, 0.5)';
      ctx.font = '700 12px "Space Mono"';
      ctx.textAlign = 'center';
      ['N', 'E', 'S', 'W'].forEach((dir, i) => {
        const angle = (i * 90 - heading - 90) * Math.PI / 180;
        const x = centerX + Math.cos(angle) * (maxVisualRadius + 18);
        const y = centerY + Math.sin(angle) * (maxVisualRadius + 18);
        ctx.fillText(dir, x, y + 5);
      });

      // Draw Radar Circles
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, (maxVisualRadius / 3) * i, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Scanner
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      const scannerAngle = (time * 1.5) % (Math.PI * 2);
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxVisualRadius);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(1, 'rgba(139, 92, 246, 0.2)');
      
      ctx.lineTo(
        centerX + Math.cos(scannerAngle) * maxVisualRadius,
        centerY + Math.sin(scannerAngle) * maxVisualRadius
      );
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
      ctx.stroke();

      // Draw Articles
      articles.forEach(article => {
        const distRatio = article.dist / radius;
        const visualDist = distRatio * maxVisualRadius;
        const angle = (article.bearing! - heading - 90) * Math.PI / 180;
        
        const x = centerX + Math.cos(angle) * visualDist;
        const y = centerY + Math.sin(angle) * visualDist;

        const pulse = Math.sin(time * 3 + article.pageid) * 2;
        
        ctx.fillStyle = mode === SonificationMode.CACOPHONY ? '#f43f5e' : 
                        mode === SonificationMode.AMBIENT ? '#3b82f6' : '#10b981';
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.fillStyle;
        
        ctx.beginPath();
        ctx.arc(x, y, 4 + pulse, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;

        if (distRatio < 0.6) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.font = '400 10px "Space Mono"';
          ctx.textAlign = 'left';
          ctx.fillText(article.title.slice(0, 18), x + 10, y + 4);
        }
      });

      animationFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrame);
  }, [articles, radius, mode, heading]);

  return (
    <div className="relative w-full aspect-square max-w-md mx-auto group">
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={600} 
        className="w-full h-full rounded-full bg-neutral-900/80 shadow-2xl shadow-violet-900/30 border border-neutral-800 backdrop-blur-sm"
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-4 h-4 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,1)] pulse-ring"></div>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/80 border border-neutral-800 rounded-full text-[10px] text-neutral-500 uppercase tracking-widest font-bold font-mono">
        Orientation Active
      </div>
    </div>
  );
};

export default Visualizer;
