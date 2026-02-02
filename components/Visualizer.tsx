
import React, { useEffect, useRef } from 'react';
import { WikipediaArticle, SonificationMode } from '../types';

interface Props {
  articles: WikipediaArticle[];
  radius: number;
  mode: SonificationMode;
}

const Visualizer: React.FC<Props> = ({ articles, radius, mode }) => {
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
      const maxVisualRadius = Math.min(centerX, centerY) - 20;

      // Draw Radar Circles
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.2)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, (maxVisualRadius / 3) * i, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Scanner
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      const scannerAngle = time % (Math.PI * 2);
      ctx.lineTo(
        centerX + Math.cos(scannerAngle) * maxVisualRadius,
        centerY + Math.sin(scannerAngle) * maxVisualRadius
      );
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
      ctx.stroke();

      // Draw Articles
      articles.forEach(article => {
        const distRatio = article.dist / radius;
        const visualDist = distRatio * maxVisualRadius;
        // Convert bearing to radians (0 is North)
        const angle = (article.bearing! - 90) * Math.PI / 180;
        
        const x = centerX + Math.cos(angle) * visualDist;
        const y = centerY + Math.sin(angle) * visualDist;

        const pulse = Math.sin(time * 2 + article.pageid) * 2;
        
        ctx.fillStyle = mode === SonificationMode.CACOPHONY ? '#f43f5e' : 
                        mode === SonificationMode.AMBIENT ? '#3b82f6' : '#10b981';
        
        ctx.beginPath();
        ctx.arc(x, y, 4 + pulse, 0, Math.PI * 2);
        ctx.fill();

        if (distRatio < 0.4) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.font = '10px Inter';
          ctx.fillText(article.title.slice(0, 15), x + 8, y + 4);
        }
      });

      animationFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrame);
  }, [articles, radius, mode]);

  return (
    <div className="relative w-full aspect-square max-w-md mx-auto">
      <canvas 
        ref={canvasRef} 
        width={500} 
        height={500} 
        className="w-full h-full rounded-full bg-neutral-900 shadow-2xl shadow-violet-900/20 border border-neutral-800"
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-4 h-4 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)] pulse-ring"></div>
      </div>
    </div>
  );
};

export default Visualizer;
