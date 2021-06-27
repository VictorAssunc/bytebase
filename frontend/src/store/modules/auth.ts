import axios from "axios";
import isEqual from "lodash-es/isEqual";
import {
  Principal,
  AuthState,
  LoginInfo,
  SignupInfo,
  ActivateInfo,
  ResourceObject,
  unknown,
  PrincipalId,
} from "../../types";
import { getIntCookie, removeCookie } from "../../utils";

function convert(user: ResourceObject, rootGetters: any): Principal {
  return rootGetters["principal/principalById"](user.id);
}

const state: () => AuthState = () => ({
  currentUser: unknown("PRINCIPAL") as Principal,
});

const getters = {
  isLoggedIn: (state: AuthState) => (): boolean => {
    return getIntCookie("user") != undefined;
  },

  currentUser: (state: AuthState) => (): Principal => {
    return state.currentUser;
  },
};

const actions = {
  async login({ commit, dispatch, rootGetters }: any, loginInfo: LoginInfo) {
    const loggedInUser = (
      await axios.post("/api/auth/login", {
        data: { type: "loginInfo", attributes: loginInfo },
      })
    ).data.data;

    // Refresh the corresponding principal
    await dispatch("principal/fetchPrincipalById", loggedInUser.id, {
      root: true,
    });

    // The conversion relies on the above refresh.
    const convertedUser = convert(loggedInUser, rootGetters);
    commit("setCurrentUser", convertedUser);
    return convertedUser;
  },

  async signup({ commit, dispatch, rootGetters }: any, signupInfo: SignupInfo) {
    const newUser = (
      await axios.post("/api/auth/signup", {
        data: { type: "signupInfo", attributes: signupInfo },
      })
    ).data.data;

    // Refresh the corresponding principal
    await dispatch("principal/fetchPrincipalById", newUser.id, { root: true });

    // The conversion relies on the above refresh.
    const convertedUser = convert(newUser, rootGetters);
    commit("setCurrentUser", convertedUser);
    return convertedUser;
  },

  async activate(
    { commit, dispatch, rootGetters }: any,
    activateInfo: ActivateInfo
  ) {
    const activatedUser = (
      await axios.post("/api/auth/activate", {
        data: { type: "activateInfo", attributes: activateInfo },
      })
    ).data.data;

    // Refresh the corresponding principal
    dispatch("principal/fetchPrincipalById", activatedUser.id, { root: true });

    // The conversion relies on the above task to get the lastest data
    const convertedUser = convert(activatedUser, rootGetters);
    commit("setCurrentUser", convertedUser);
    return convertedUser;
  },

  async restoreUser({ commit, dispatch }: any) {
    const userId = getIntCookie("user");
    if (userId) {
      const loggedInUser = await dispatch(
        "principal/fetchPrincipalById",
        userId,
        {
          root: true,
        }
      );

      commit("setCurrentUser", loggedInUser);
      return loggedInUser;
    }
    return unknown("PRINCIPAL") as Principal;
  },

  async refreshUserIfNeeded(
    { commit, state, rootGetters }: any,
    principalId: PrincipalId
  ) {
    if (principalId == state.currentUser.id) {
      const refreshedUser = rootGetters["principal/principalById"](
        state.currentUser.id
      );
      if (!isEqual(refreshedUser, state.currentUser)) {
        commit("setCurrentUser", refreshedUser);
      }
    }
  },

  async logout({ commit }: any) {
    removeCookie("user");
    commit("setCurrentUser", unknown("PRINCIPAL") as Principal);
    return unknown("PRINCIPAL") as Principal;
  },
};

const mutations = {
  setCurrentUser(state: AuthState, user: Principal) {
    state.currentUser = user;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
