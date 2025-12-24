// Performance monitoring using Web Vitals
import { onCLS, onINP, onFCP, onLCP, onTTFB, type Metric } from 'web-vitals';

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

// Log metrics to console in development
function logMetric(metric: Metric): void {
  const { name, value, rating, delta, id } = metric as Metric & { rating: 'good' | 'needs-improvement' | 'poor' };
  
  const performanceMetric: PerformanceMetric = {
    name,
    value,
    rating,
    delta,
    id,
  };

  if (import.meta.env.DEV) {
    console.log('[Performance]', performanceMetric);
  }

  // In production, you could send to analytics service
  // sendToAnalytics(performanceMetric);
}

// Initialize Web Vitals monitoring
export function initPerformanceMonitoring(): void {
  // Core Web Vitals
  onCLS(logMetric); // Cumulative Layout Shift
  onINP(logMetric); // Interaction to Next Paint (replaces FID)
  onLCP(logMetric); // Largest Contentful Paint
  
  // Other important metrics
  onFCP(logMetric); // First Contentful Paint
  onTTFB(logMetric); // Time to First Byte
}

// Performance observer for long tasks
export function observeLongTasks(): void {
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            console.warn('[Performance] Long task detected:', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
            });
          }
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      // Long task API not supported
    }
  }
}

// Custom performance marks
export function markPerformance(markName: string): void {
  if ('performance' in window && 'mark' in performance) {
    performance.mark(markName);
  }
}

// Measure between marks
export function measurePerformance(measureName: string, startMark: string, endMark: string): void {
  if ('performance' in window && 'measure' in performance) {
    try {
      const measure = performance.measure(measureName, startMark, endMark);
      if (import.meta.env.DEV) {
        console.log(`[Performance] ${measureName}:`, measure.duration.toFixed(2), 'ms');
      }
    } catch (e) {
      // Marks don't exist
    }
  }
}
