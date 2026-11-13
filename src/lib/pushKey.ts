// 웹 푸시 VAPID 공개 키(공개해도 되는 키). 짝이 되는 비밀 키는 Vercel 환경변수 VAPID_PRIVATE_KEY에만 있다.
// 11-08 새 키로 교체(옛 비밀 키를 잃어버림). 이미 알림을 켠 기기는 앱을 열 때 새 키로 자동 재구독된다(lib/push.ts syncPush).
export const VAPID_PUBLIC_KEY = 'BClyOv-WQhubtkVdbrHTBjiYdC7BKQ7x9caJWX4Ninh4gkucggT53mkwoyyzw3wKnhra1GWYGb70SaI4PcacVZs';
