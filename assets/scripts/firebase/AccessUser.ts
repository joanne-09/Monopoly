export interface UserData {
    email: string;
    username: string;
    usermoney?: number;
    createdAt?: any;
}

export default class AccessUser {
    public static async saveUser(userId: string, email: string, username: string, initialMoney: number = 0, initialLevel: number = 0): Promise<void> {
        const db = firebase.firestore();

        const userData: UserData = {
            email: email,
            username: username,
            usermoney: initialMoney,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        try {
            await db.collection("users").doc(userId).set(userData, { merge: true });
            cc.log("User saved successfully");
        } catch (error) {
            cc.error("Error saving user: ", error);
            throw error;
        }
    }

    public static async getUser(userId: string): Promise<UserData | null> {
        const db = firebase.firestore();

        try {
            const doc = await db.collection("users").doc(userId).get();
            if (doc.exists) {
                return doc.data() as UserData;
            } else {
                cc.warn("No such user!");
                return null;
            }
        } catch (error) {
            cc.error("Error getting user: ", error);
            throw error;
        }
    }

    public static async updateUser(userId: string, data: Partial<UserData>): Promise<void> {
        const db = firebase.firestore();

        try {
            await db.collection("users").doc(userId).update(data);
            cc.log("User updated successfully");
        } catch (error) {
            cc.error("Error updating user: ", error);
            throw error;
        }
    }
}