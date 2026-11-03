import { Component, type ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { color, space } from '@/theme/tokens';

/** 실험실 화면에서 오류가 나도 앱 전체가 멈추지 않게 막아 준다. */
export class LabErrorBoundary extends Component<{ slug: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, padding: space.xl, gap: space.md, backgroundColor: color.bg }}>
        <AppText variant="heading">이 실험실 화면에서 오류가 났어요</AppText>
        <AppText variant="body" color={color.inkMuted}>
          {`src/lab/${this.props.slug}/ 를 만든 사람이라면, 아래 글을 복사해서 AI에게 "이 오류 고쳐 줘"라고 보내세요.`}
        </AppText>
        <AppText variant="caption" color={color.danger} selectable>
          {String(this.state.error?.message ?? this.state.error)}
        </AppText>
      </View>
    );
  }
}
