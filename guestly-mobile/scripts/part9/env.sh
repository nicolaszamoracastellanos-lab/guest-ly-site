# Part 9 harness environment. Source this at the start of EVERY command:
#   source /Users/nicolas_z/Desktop/guest-ly/guestly-mobile/scripts/part9/env.sh
# Shell state does not persist between agent tool calls, so nothing here is
# optional. No secrets live in this file.

export GL_ROOT="/Users/nicolas_z/Desktop/guest-ly/guestly-mobile"
export GL_PART9="$GL_ROOT/.part9"
export GL_BUNDLE_ID="com.zcventures.guestly"

# Java 17 (brew install openjdk@17) and Maestro (official installer).
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

# Simulators (iOS 26.5 runtime).
#   S  small   iPhone SE (3rd generation), 375x667 pt, created for this wave
#   M  medium  iPhone 17e, 390x844 pt (pass A11)
#   L  large   iPhone 17 Pro Max, 440x956 pt, 1320x2868 px (store size)
#   T  tablet  iPad mini (A17 Pro), iPhone compatibility mode
#   P  tablet  iPad Pro 13-inch (M5), spot check only
export GL_UDID_S="B9898E62-D4D4-452A-B4B0-460D4A016ED2"
export GL_UDID_M="30398ECB-3A6B-4A34-BC77-B9FB8B4EF25F"
export GL_UDID_L="615D5183-56C3-4184-BC78-0FAB711D9A50"
export GL_UDID_T="B1D6BA49-2379-4886-BA9B-3A3FB4C71897"
export GL_UDID_P="F5F84E6A-4E3B-4417-A413-368E0A5BAC81"

# Ports. 8081 and 3000 may belong to other apps on this Mac.
export GL_METRO_PORT=8097
export GL_PROXY_PORT=8787
export GL_WEB_PORT=8793

# Dev client deep link that loads the bundle from the local Metro.
export GL_DEVCLIENT_URL="exp+guestly://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A${GL_METRO_PORT}"

# Which binary is installed: "dev" (sim-dev, JS from Metro) or "release"
# (sim-release, embedded JS). sim.sh and walk.mjs read it.
export GL_BINARY="${GL_BINARY:-dev}"

gl_udid() {
  case "$1" in
    S|s) echo "$GL_UDID_S" ;;
    M|m) echo "$GL_UDID_M" ;;
    L|l) echo "$GL_UDID_L" ;;
    T|t) echo "$GL_UDID_T" ;;
    P|p) echo "$GL_UDID_P" ;;
    *) echo "$1" ;;
  esac
}
