import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { RatingEntity } from "./rating.entity";

@Entity("rating_photos")
export class RatingPhotoEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  ratingId!: string;

  @Column({ type: "varchar" })
  url!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => RatingEntity, (r) => r.photos, { onDelete: "CASCADE" })
  rating!: RatingEntity;
}
