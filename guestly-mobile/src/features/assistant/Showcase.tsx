// What a couple sees on the Coordinator tab when the Coordinator is not on for
// their wedding: examples of what it does, so the tab sells itself. Every
// example is something the Coordinator really does (it reads the guest list,
// RSVPs, budget, seating and website, and proposes changes behind a Confirm
// card; a broadcast needs the typed word). The conversations are illustrations
// and say so.
//
// App Store rule (guidelines 3.1.1 / 3.1.3, owner decision Sep 29 2026, same as
// app/pending.tsx): no price, no purchase wording and no link out, except on
// the United States storefront, where "See it on the web" opens the site. On
// every other storefront the only action is an email to the team.

import React, { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Linking } from "react-native";
import { useFeatureCopy } from "@/i18n/feature";
import { getStorefront } from "@/lib/storefront";
import { Avatar, Button, Card, Icon, Row, SectionLabel, Stack, T, useBottomClearance, type IconName } from "@/ui";
import { colors } from "@/ui/tokens";

const WEB_URL = "https://guest-ly.com/#coordinator";
const MAIL_URL = "mailto:hello@guest-ly.com?subject=Coordinator";

type Example = { icon: IconName; ask: string; answer: string };

const COPY = {
  en: {
    eyebrow: "The Coordinator",
    title: "Run your wedding by asking.",
    body: "An AI assistant that already knows your guest list, replies, budget, seating and website. Ask it in plain words. It reads first, proposes the change, and nothing happens until you tap Confirm.",
    examplesLabel: "What it does for you",
    illustration: "Example conversations, with made-up names and numbers.",
    examples: [
      { icon: "guests", ask: "Who has not replied yet?", answer: "38 parties are still pending, 12 of them past the deadline. Want me to remind them?" },
      { icon: "plus", ask: "Add the Rivera family, 4 people, two vegetarian meals.", answer: "Ready to add 1 party, 4 seats, 2 vegetarian. Confirm and it is on the list." },
      { icon: "megaphone", ask: "Remind everyone who has not answered.", answer: "Message ready for 38 guests in their own language. Type SEND to confirm." },
      { icon: "wallet", ask: "Where are we against the budget?", answer: "62% paid. The biggest open balance is the venue, due in March." },
      { icon: "globe", ask: "The shuttle leaves at 4:30 now. Update the website.", answer: "I changed the Travel section. Check it and tap Confirm to publish." },
    ] as Example[],
    trust: ["Reads your real wedding data", "Nothing changes until you confirm", "Messages to guests need a typed OK"],
    cta: "Want it for your wedding?",
    ctaBody: "The Coordinator is an optional add-on. Write to us and we will switch it on for you.",
    mail: "Email us about the Coordinator",
    web: "See it on the web",
  },
  es: {
    eyebrow: "El Coordinador",
    title: "Maneja tu boda pidiéndolo.",
    body: "Un asistente de IA que ya conoce tu lista de invitados, respuestas, presupuesto, mesas y sitio web. Pídele las cosas con tus palabras. Primero lee, luego propone el cambio, y nada pasa hasta que toques Confirmar.",
    examplesLabel: "Lo que hace por ti",
    illustration: "Conversaciones de ejemplo, con nombres y números inventados.",
    examples: [
      { icon: "guests", ask: "¿Quién no ha respondido todavía?", answer: "Faltan 38 grupos, 12 de ellos ya pasaron la fecha límite. ¿Les mando un recordatorio?" },
      { icon: "plus", ask: "Agrega a la familia Rivera, 4 personas, dos menús vegetarianos.", answer: "Listo para agregar 1 grupo, 4 lugares, 2 vegetarianos. Confirma y queda en la lista." },
      { icon: "megaphone", ask: "Recuérdales a todos los que no han contestado.", answer: "Mensaje listo para 38 invitados, cada uno en su idioma. Escribe ENVIAR para confirmar." },
      { icon: "wallet", ask: "¿Cómo vamos con el presupuesto?", answer: "62% pagado. El saldo más grande es el lugar, vence en marzo." },
      { icon: "globe", ask: "El transporte sale a las 4:30. Actualiza el sitio web.", answer: "Cambié la sección de Viaje. Revísala y toca Confirmar para publicar." },
    ] as Example[],
    trust: ["Lee los datos reales de tu boda", "Nada cambia hasta que confirmes", "Los mensajes a invitados piden un OK escrito"],
    cta: "¿Lo quieres para tu boda?",
    ctaBody: "El Coordinador es un complemento opcional. Escríbenos y lo activamos para ti.",
    mail: "Escríbenos sobre el Coordinador",
    web: "Verlo en la web",
  },
};

export function CoordinatorShowcase() {
  const c = useFeatureCopy(COPY);
  const { clearance } = useBottomClearance();
  const [us, setUs] = useState(false);
  useEffect(() => {
    let alive = true;
    void getStorefront().then((s) => alive && setUs(s.isUS));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: clearance + 8 }} testID="coordinator-showcase">
      <Stack gap={10}>
        <Row gap={10}>
          <Avatar gem size={40} />
          <SectionLabel color={colors.goldLight}>{c.eyebrow}</SectionLabel>
        </Row>
        <T v="title26">
          {c.title}
        </T>
        <T v="body15" color={colors.ivory70}>
          {c.body}
        </T>
      </Stack>

      <SectionLabel style={{ marginTop: 28, marginBottom: 10 }}>{c.examplesLabel}</SectionLabel>
      <Stack gap={12}>
        {c.examples.map((e) => (
          <Card key={e.ask} kind="solid" padding={14} radiusKey="tile">
            <Stack gap={10}>
              <View style={{ alignItems: "flex-end" }}>
                <View style={styles.me}>
                  <T v="body15" color={colors.night}>
                    {e.ask}
                  </T>
                </View>
              </View>
              <Row gap={10} align="flex-start">
                <View style={styles.icon}>
                  <Icon name={e.icon} size={16} color={colors.goldLight} />
                </View>
                <View style={styles.bot}>
                  <T v="body15">{e.answer}</T>
                </View>
              </Row>
            </Stack>
          </Card>
        ))}
      </Stack>
      <T v="meta13" color={colors.ivory55} style={{ marginTop: 10 }}>
        {c.illustration}
      </T>

      <Stack gap={8} style={{ marginTop: 22 }}>
        {c.trust.map((t) => (
          <Row key={t} gap={10}>
            <Icon name="check" size={18} color={colors.goldLight} />
            <T v="body15" color={colors.ivory90} style={{ flex: 1 }}>
              {t}
            </T>
          </Row>
        ))}
      </Stack>

      <Card kind="solid" padding={18} radiusKey="tile" border={colors.goldBorder} style={{ marginTop: 26 }}>
        <Stack gap={10}>
          <T v="title26">{c.cta}</T>
          <T v="body15" color={colors.ivory70}>
            {c.ctaBody}
          </T>
          <Button label={c.mail} icon="mail" onPress={() => void Linking.openURL(MAIL_URL).catch(() => {})} testID="coordinator-showcase-mail" />
          {us ? <Button label={c.web} kind="glass" onPress={() => void Linking.openURL(WEB_URL).catch(() => {})} testID="coordinator-showcase-web" /> : null}
        </Stack>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  me: { maxWidth: "88%", backgroundColor: colors.gold, borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  bot: { flex: 1, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)", borderRadius: 18, borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  icon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.goldWash, alignItems: "center", justifyContent: "center", marginTop: 2 },
});
