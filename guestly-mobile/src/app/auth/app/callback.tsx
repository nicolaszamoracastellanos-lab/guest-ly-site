// https://app.guest-ly.com/auth/app/callback (the universal link in the
// sign-in email). app/+native-intent normally rewrites it to /auth/callback
// before the router sees it; this route is the same screen in case a path
// ever arrives here without passing through it.

export { default } from "../callback";
